import { useCallback, useEffect, useRef } from 'react';
import { ref, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { buildDeck } from '../utils/deck';
import * as rules from '../rules';

const ROOM_KEY = 'blindrank_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  players: [localProfile],
});

// Realtime Database drops empty objects/arrays, and a board of ten nulls is
// exactly that — so a round nobody has placed in yet reads back with no `boards`
// node at all, and a half-filled board comes back sparse or index-keyed.
// rules.normalizeBoards repairs both. Runs here (the subscription) and inside
// every transaction below, which see the raw stored value.
function normalizeGame(game, playerIds) {
  if (!game) return null;
  const deck = game.deck ?? [];
  return {
    ...game,
    deck,
    cursor: game.cursor ?? 0,
    boards: rules.normalizeBoards(game.boards, playerIds, deck.length || rules.BOARD_SIZE),
  };
}

const normalizeState = (val) => {
  const players = (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  }));
  return {
    view: val.view,
    hostId: val.hostId ?? null,
    settings: val.settings ?? null,
    presence: val.presence ?? {},
    totalScores: val.totalScores ?? {},
    players,
    game: normalizeGame(val.game, players.map((p) => p.id)),
  };
};

// The Firebase-backed twin of useBlindRankRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// Everyone places at once here rather than passing a device, but the cursor is
// still shared: the next show is revealed only when every *active* player has
// committed the current one. That gate is the only place a departure can wedge
// the round, and the reconciliation effect at the bottom is what unsticks it.
export function useBlindRankRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, guard, bestEffort, once, setSyncError, roster, rosterRef,
  } = core;

  const game = state?.game ?? null;
  const playerIds = players.map((p) => p.id);

  // Read through a ref inside the transaction callback, which must not close
  // over a stale render's roster. EVERY player, not the active ones: the active
  // roster gates readiness, but a departed player's board still has to survive
  // the write and be there at the reveal.
  const playerIdsRef = useRef(playerIds);
  useEffect(() => { playerIdsRef.current = playerIds; });

  // Every mutation of the round funnels through one transaction on state/game
  // so two devices placing at the same instant can't lose each other's write.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = normalizeGame(raw, playerIdsRef.current);
      if (!current) return; // abort — no round yet
      const { patch } = fn(current);
      if (!patch || Object.keys(patch).length === 0) return; // abort — rule no-op
      return { ...current, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, [roomCode, setSyncError]);

  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    // Deal from the players actually here — a departed player's list should not
    // shape the deck, least of all under "shared shows only".
    const dealtIn = rosterRef.current.active;
    const db = getFirebaseDb();
    const { deck, candidates, enough } = buildDeck(dealtIn, { sharedOnly: settings.sharedOnly });
    if (!enough) {
      setSyncError(`Only ${candidates} shows with a known air date in common — need ${rules.BOARD_SIZE}.`);
      return;
    }
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      game: rules.startRound(dealtIn, deck),
      view: 'round',
    });
  }, [isHost, roomCode, patchState, bestEffort, rosterRef, setSyncError]);

  const place = useCallback((slotIndex) => (
    applyGame((g) => rules.placeItem(g, myPlayerId, slotIndex))
  ), [applyGame, myPlayerId]);

  // Back to the lobby to play again with the same group; reopens the room so
  // someone new can still join between games.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', game: null });
  }, [roomCode, patchState, bestEffort]);

  // Banks the round into the running totals exactly once, then shows the
  // results. Every device can reach this, so the claim transaction — not
  // ordering — is what stops the scores being applied twice.
  const finishRound = useCallback(async () => {
    const db = getFirebaseDb();
    const snapshot = state?.game;
    if (!snapshot) return false;
    const scores = rules.finalScores(snapshot, playerIds);

    const claim = await runTransaction(ref(db, `rooms/${roomCode}/state/bankedAt`), (cur) =>
      (cur === snapshot.cursor ? undefined : snapshot.cursor)
    ).catch(() => null);
    if (!claim) return false; // transient — retry on a later render
    if (claim.committed) {
      await patchState({ totalScores: rules.applyRoundScores(state.totalScores ?? {}, scores) });
    }
    await runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
      (cur === 'results' ? undefined : 'results')
    ).catch(() => {});
    return true;
  }, [roomCode, state, playerIds, patchState]);

  // --- Departure reconciliation ----------------------------------------------
  //
  // useRoomCore has already moved the crown if the host went. What's left is the
  // one gate this game has: the shared cursor waits for everybody, so a closed
  // tab would hold the round on the same show forever. Any device may run these
  // — each is a transaction that aborts if someone else got there first.
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId) return;
    const { active, activeIds } = roster;
    const view = state.view;
    if (view !== 'round' || !game) return;

    // Nobody left to play against.
    if (active.length < 1) return;

    const done = game.cursor >= game.deck.length;
    if (done) {
      once('finish', () => finishRound());
      return;
    }

    // Everyone still here has committed this show — reveal the next one.
    if (rules.everyonePlaced(game, activeIds)) {
      once(`advance:${game.cursor}:${activeIds.join(',')}`, () =>
        applyGame((g) => (
          // Re-check inside the transaction against the stored value: another
          // device may have advanced already, and the cursor must move once.
          g.cursor === game.cursor ? rules.advanceCursor(g) : { patch: {} }
        )));
    }
  }, [roomCode, state, game, myPlayerId, roster, once, applyGame, finishRound]);

  return {
    uid: core.uid, roomCode, myPlayerId,
    error: core.error, syncError: core.syncError,
    dismissError: core.dismissError, dismissSyncError: core.dismissSyncError,
    createRoom: core.createRoom, joinRoom: core.joinRoom, leaveRoom: core.leaveRoom,
    updateMyProfile: core.updateMyProfile, setView: core.setView, returnToLobby,
    view: state?.view,
    hostId: core.hostId, isHost, hostName: core.hostName,
    players,
    settings: state?.settings ?? null,
    totalScores: state?.totalScores ?? {},
    game,
    deck: game?.deck ?? [],
    cursor: game?.cursor ?? 0,
    item: game ? rules.currentItem(game) : null,
    myBoard: game ? rules.normalizeBoard(game.boards?.[myPlayerId], game.deck.length) : [],
    iHavePlaced: game ? rules.placedCount(game.boards?.[myPlayerId]) > game.cursor : false,
    // Who the round is still waiting on — rendered as names, so a paused board
    // says why rather than just sitting there.
    pendingNames: game
      ? rules.pendingPlacers(game, core.activeIds).map(
        (id) => players.find((p) => p.id === id)?.name ?? id
      )
      : [],
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    startGame, place, guard,
  };
}
