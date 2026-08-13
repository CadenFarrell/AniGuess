import { useCallback, useEffect, useRef } from 'react';
import { ref, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { buildDeck } from '../utils/deck';
import { getAxis, isOpinion } from '../axes';
import * as rules from '../rules';

const ROOM_KEY = 'anirank_online_room';

// The round's axis, out of the settings the host wrote.
//
// `settings.axis` is a spec: a built-in's id, or — for a prompt the host wrote
// themselves — its whole definition. It has to be the definition, because a
// guest's device has never seen that prompt and no id would resolve to anything
// but the default on it. `axisId` is the field's older name, still read so a
// room created by the previous build finishes its game.
const settingsAxis = (settings) => getAxis(settings?.axis ?? settings?.axisId);

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  // Counts rounds played so the opinion subject walks the roster instead of
  // landing on the same person every game. Stored on the room, not derived from
  // totalScores, because an unscored round still has to advance the turn.
  roundIndex: 0,
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
    // `!== false` rather than `?? true`: a round written before open mode
    // existed carries no flag at all, and every one of those was blind.
    blind: game.blind !== false,
    // Nobody locked in yet is an empty object, which RTDB does not store.
    locked: game.locked ?? {},
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
    // What the last banked round was worth, so the reveal can show `+N` beside a
    // total that has been accumulating since the room opened. Absent on an
    // unscored round — RTDB does not store `{}`.
    roundScores: val.roundScores ?? {},
    roundIndex: val.roundIndex ?? 0,
    players,
    game: normalizeGame(val.game, players.map((p) => p.id)),
  };
};

// The Firebase-backed twin of useAniRankRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// Everyone places at once here rather than passing a device, but the cursor is
// still shared: the next show is revealed only when every *active* player has
// committed the current one. That gate is the only place a departure can wedge
// the round, and the reconciliation effect at the bottom is what unsticks it.
export function useAniRankRoom() {
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
    // shape the deck, least of all under "shared cards only".
    const dealtIn = rosterRef.current.active;
    const db = getFirebaseDb();
    const axis = settingsAxis(settings);
    const { deck, candidates, enough } = buildDeck(dealtIn, {
      axis,
      sharedOnly: settings.sharedOnly,
    });
    if (!enough) {
      const noun = axis.items === 'characters' ? 'characters' : 'shows';
      setSyncError(
        `Only ${candidates} ${noun} in common for this mode — need ${rules.BOARD_SIZE}.`
      );
      return;
    }

    const roundIndex = state?.roundIndex ?? 0;
    const subjectId = isOpinion(axis)
      ? rules.subjectFor(dealtIn.map((p) => p.id), roundIndex)
      : null;

    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      game: rules.startRound(dealtIn, deck, subjectId, { blind: settings.blind !== false }),
      roundIndex: roundIndex + 1,
      // Clearing the banking claim is load-bearing, not tidiness. finishRound
      // claims a round by writing bankedAt only if it differs from the round's
      // cursor, and returnToLobby leaves the old value behind — so a second
      // blind round, which also ends on cursor 10, would find bankedAt already
      // 10, abort the claim and silently never add its scores. An open round
      // never moves the cursor off 0, which would make that every round.
      bankedAt: null,
      view: 'round',
    });
  }, [isHost, roomCode, patchState, bestEffort, rosterRef, setSyncError, state]);

  const place = useCallback((slotIndex) => (
    applyGame((g) => rules.placeItem(g, myPlayerId, slotIndex))
  ), [applyGame, myPlayerId]);

  // The open-round trio. Same single transaction on state/game as `place`, so a
  // player rearranging their board cannot lose a write from someone else doing
  // the same at that instant.
  const placeCard = useCallback((itemId, slotIndex) => (
    applyGame((g) => rules.placeCard(g, myPlayerId, itemId, slotIndex))
  ), [applyGame, myPlayerId]);

  const clearSlot = useCallback((slotIndex) => (
    applyGame((g) => rules.clearSlot(g, myPlayerId, slotIndex))
  ), [applyGame, myPlayerId]);

  const lockIn = useCallback(() => (
    applyGame((g) => rules.lockIn(g, myPlayerId))
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
    const axis = settingsAxis(state?.settings);
    // Returns {} when the round has no answer key — an unscored round, or an
    // opinion round whose subject left before finishing their board. Banking an
    // empty object is a no-op, so the reveal still happens, just without points.
    const scores = rules.finalScores(snapshot, playerIds, {
      opinion: isOpinion(axis),
      scoring: state?.settings?.scoring !== false,
    });

    const claim = await runTransaction(ref(db, `rooms/${roomCode}/state/bankedAt`), (cur) =>
      (cur === snapshot.cursor ? undefined : snapshot.cursor)
    ).catch(() => null);
    if (!claim) return false; // transient — retry on a later render
    if (claim.committed) {
      await patchState({
        totalScores: rules.applyRoundScores(state.totalScores ?? {}, scores),
        // Banked in the same write as the totals, by the one device that won the
        // claim, so the `+N` on the reveal can never disagree with the points it
        // sits beside. Explicitly null rather than `{}` when the round scored
        // nothing: RTDB drops an empty object, which would leave the PREVIOUS
        // round's deltas on screen instead of none.
        roundScores: Object.keys(scores).length ? scores : null,
      });
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

    // The opinion subject IS the answer key, so their leaving is this game's
    // second way to wedge a round. Reassigning is only safe before anyone has
    // committed anything — after that, boards were built against a specific
    // person and swapping them would silently rescore work already done, so the
    // round plays out and finalScores returns no key (an unscored reveal).
    if (game.subjectId && !activeIds.includes(game.subjectId) && rules.roundUntouched(game)) {
      const heir = activeIds[0];
      if (heir) {
        once(`subject:${game.subjectId}:${heir}`, () =>
          applyGame((g) => (
            rules.roundUntouched(g) && g.subjectId === game.subjectId
              ? { patch: { subjectId: heir } }
              : { patch: {} }
          )));
      }
      return;
    }

    // Blind: the deck ran out. Open: everyone still here has locked in — which
    // is also the gate that unsticks a round whose last player closed their tab.
    if (rules.roundFinished(game, activeIds)) {
      once('finish', () => finishRound());
      return;
    }

    // An open round has no cursor to move — boards are committed whole, and the
    // check above is the only thing that ends it.
    if (rules.isOpen(game)) return;

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

  const myBoard = game
    ? rules.normalizeBoard(game.boards?.[myPlayerId], game.deck.length)
    : [];

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
    roundScores: state?.roundScores ?? {},
    game,
    // The round's axis and subject, resolved once here so no screen has to
    // re-derive them from settings — and getAxis never returns undefined, so a
    // room written by an older build still renders.
    axis: settingsAxis(state?.settings),
    scoring: state?.settings?.scoring !== false,
    subjectId: game?.subjectId ?? null,
    subject: players.find((p) => p.id === game?.subjectId) ?? null,
    deck: game?.deck ?? [],
    cursor: game?.cursor ?? 0,
    // Read off the round, not the settings: the round is what the rules act on,
    // and it is the copy that survived RTDB and normalizeGame's defaulting.
    open: game ? rules.isOpen(game) : false,
    item: game ? rules.currentItem(game) : null,
    myBoard,
    tray: game ? rules.unplacedCards(game, myPlayerId) : [],
    boardFull: myBoard.length > 0 && myBoard.every(Boolean),
    iHavePlaced: game ? rules.placedCount(game.boards?.[myPlayerId]) > game.cursor : false,
    iHaveLockedIn: game ? !!game.locked?.[myPlayerId] : false,
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
    startGame, place, placeCard, clearSlot, lockIn, guard,
  };
}
