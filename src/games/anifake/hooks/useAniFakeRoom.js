import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, onValue, set, update, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { eligibleCharacters } from '../utils/pool';
import { getMode } from '../modes';
import * as rules from '../rules';

const ROOM_KEY = 'anifake_online_room';

const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  // Stamps every dealt card. Cards in secrets/ are overwritten rather than
  // cleared between rounds — a clear that half-failed would leave last round's
  // answer readable — so this is what makes a stale card unreadable instead of
  // silently wrong. Same trick as AniGuess's assignment forRound stamp.
  roundNumber: 0,
  players: [localProfile],
});

// Realtime Database does not store empty objects or arrays, so a round nobody
// has spoken in yet reads back with no `clues` at all, and `votes`/`reveal`/
// `steal` are missing until the first write to each. Runs here (the
// subscription) and inside every transaction below, which see the raw stored
// value.
function toArray(raw) {
  if (Array.isArray(raw)) return raw.filter((x) => x != null);
  if (!raw) return [];
  // An index-keyed object is what RTDB hands back for an array it decided was
  // sparse. `clues` is appended densely so this should never fire, but the
  // shape is cheap to accept and expensive to debug online.
  return Object.keys(raw)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => raw[k])
    .filter((x) => x != null);
}

function normalizeGame(game) {
  if (!game) return null;
  return {
    ...game,
    order: toArray(game.order),
    clues: toArray(game.clues),
    turn: game.turn ?? 0,
    laps: game.laps ?? 1,
    wordLimit: game.wordLimit ?? 1,
    votes: game.votes ?? {},
    reveal: game.reveal ?? {},
    steal: game.steal ?? null,
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
    roundNumber: val.roundNumber ?? 0,
    players,
    game: normalizeGame(val.game),
  };
};

// The Firebase-backed twin of useAniFakeRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// The one structural difference from the other games: the thing a player must
// not learn does not live in state/ at all. Everyone in a room reads state/ in
// full, so the dealt cards go to rooms/{code}/secrets/{playerId}, whose rules
// let only the owner read them — the mirror of the assignments/ node AniGuess
// uses for the opposite job. This is that node's first consumer.
//
// That is also why there is no candidate list in state/ anymore. An earlier
// build put a sixteen-card board there for the fake to bluff off; a fake with
// devtools reads state/ in full, and once the setup gate that guaranteed
// sixteen came off, a two-card "board" would have handed them the answer. The
// fake gets a dealt hint word instead — see rules.dealRoles.
export function useAniFakeRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, guard, bestEffort, once, setSyncError, rosterRef, roster,
  } = core;

  const game = state?.game ?? null;
  const roundNumber = state?.roundNumber ?? 0;
  const mode = getMode(state?.settings?.mode);

  // --- the dealt card --------------------------------------------------------
  //
  // secrets/ is a SIBLING of state/, so useRoomCore's subscription never sees
  // it and this needs its own. Precedent: useRoom.js's assignments listener.
  const [dealt, setDealt] = useState(null);
  useEffect(() => {
    if (!roomCode || !myPlayerId) return undefined;
    const db = getFirebaseDb();
    const cardRef = ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`);
    const unsub = onValue(cardRef, (snap) => setDealt(snap.val() ?? null), () => setDealt(null));
    return () => { unsub(); setDealt(null); };
  }, [roomCode, myPlayerId]);

  // A card from a previous round is still sitting there — the stamp is what
  // makes it invisible rather than wrong. This is also what makes a refresh
  // mid-round work: the card is re-read from the room, not from local state.
  const card = dealt && dealt.forRound === roundNumber ? dealt : null;

  // --- writes ----------------------------------------------------------------

  // Every mutation of the round funnels through one transaction on state/game
  // so two devices acting at the same instant can't lose each other's write.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = normalizeGame(raw);
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
    // shape the pool, least of all under "shared characters only".
    const dealtIn = rosterRef.current.active;
    const ids = dealtIn.map((p) => p.id);
    if (ids.length < rules.MIN_PLAYERS) {
      setSyncError(`AniFake needs ${rules.MIN_PLAYERS} players.`);
      return;
    }

    const pool = eligibleCharacters(dealtIn, { sharedOnly: settings.sharedOnly });
    const needed = rules.minPool(settings.mode);
    if (pool.length < needed) {
      setSyncError(
        `Only ${pool.length} characters in common — ${settings.mode} mode needs ${needed}.`
      );
      return;
    }

    const nextRound = roundNumber + 1;
    // ONLY `secrets` is destructured, deliberately. dealRoles also returns
    // fakeId and the secret character, and this — the host's device — is the
    // one place in the system where those exist in the clear. Binding them to
    // anything that outlives this call (state, a ref, the room) would put the
    // answer on a player's screen. A serverless party game cannot do better
    // than this: some device has to compute the deal, and there is no trusted
    // third party to be it. Moving the deal into a Cloud Function is the real
    // fix.
    const { secrets } = rules.dealRoles(ids, pool, { mode: settings.mode, round: nextRound });

    const db = getFirebaseDb();
    // One batch, so a half-dealt round cannot exist. These paths depend only on
    // membership, which was written at join, so the memberUids-first ordering
    // that createRoom/joinRoom need does not apply here.
    const updates = {};
    for (const [id, entry] of Object.entries(secrets)) {
      updates[`rooms/${roomCode}/secrets/${id}`] = entry;
    }
    await guard(update(ref(db), updates));

    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      roundNumber: nextRound,
      game: rules.startRound(ids, {
        mode: settings.mode, laps: settings.laps, wordLimit: 1, round: nextRound,
      }),
      view: 'clues',
    });
  }, [isHost, roomCode, roundNumber, patchState, guard, bestEffort, rosterRef, setSyncError]);

  const submitClue = useCallback((text) => (
    applyGame((g) => rules.submitClue(g, myPlayerId, text))
  ), [applyGame, myPlayerId]);

  const castVote = useCallback((targetId) => (
    applyGame((g) => rules.castVote(g, myPlayerId, targetId))
  ), [applyGame, myPlayerId]);

  const submitSteal = useCallback((name) => (
    applyGame((g) => rules.submitSteal(g, name))
  ), [applyGame]);

  // Back to the lobby to play again with the same group; reopens the room so
  // someone new can still join between rounds.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', game: null });
  }, [roomCode, patchState, bestEffort]);

  // --- the answer ------------------------------------------------------------
  //
  // Reconstructed from the cards every device published for itself. Every
  // player computes the identical result from the identical shared state, so
  // there is no authority here to be wrong or to leave.
  // Memoized so finishRound's identity is stable between renders — every player
  // in the room, not the active ones: a departed crew member's published card
  // is still evidence, and dropping it would change who deriveTruth blames.
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const truth = game
    ? rules.deriveTruth(game.reveal, playerIds)
    : { fakeId: null, secret: null, fakeCard: null };

  // Banks the round into the running totals exactly once, then shows the
  // reveal. Every device can reach this, so the claim transaction — not
  // ordering — is what stops the scores being applied twice.
  const finishRound = useCallback(async () => {
    const db = getFirebaseDb();
    const snapshot = state?.game;
    if (!snapshot) return false;
    // Recomputed here rather than read off `truth`, so the scores are banked
    // from the same snapshot the claim is keyed on.
    const answer = rules.deriveTruth(snapshot.reveal, playerIds);
    // Returns {} when too much of the room left before publishing — an unscored
    // reveal, the same call AniRank makes for a subject who never finished.
    const scores = rules.scoreRound(snapshot, answer);

    const claim = await runTransaction(ref(db, `rooms/${roomCode}/state/bankedAt`), (cur) =>
      (cur === roundNumber ? undefined : roundNumber)
    ).catch(() => null);
    if (!claim) return false; // transient — retry on a later render
    if (claim.committed) {
      await patchState({ totalScores: rules.applyRoundScores(state.totalScores ?? {}, scores) });
    }
    await runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
      (cur === 'results' ? undefined : 'results')
    ).catch(() => {});
    return true;
  }, [roomCode, state, playerIds, roundNumber, patchState]);

  // --- departure reconciliation ----------------------------------------------
  //
  // useRoomCore has already moved the crown if the host went. What's left is
  // every gate that counts the roster. Any device may run these — each is a
  // transaction that aborts if another device got there first, so two devices
  // racing compute the identical patch.
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId || !game) return;
    const { activeIds, departedIds } = roster;
    const view = state.view;
    if (!activeIds.length) return;

    const setViewOnce = (key, next) => once(key, () => {
      const db = getFirebaseDb();
      return runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
        (cur === next ? undefined : next)
      ).catch(() => {});
    });

    if (view === 'clues') {
      if (rules.cluesDone(game)) { setViewOnce('tovote', 'vote'); return; }
      // The lap waits on one player at a time, so a closed tab holds it forever.
      const speaker = rules.currentSpeakerId(game);
      if (speaker && departedIds.includes(speaker)) {
        once(`skip:${game.turn}`, () => applyGame((g) => (
          // Re-check inside the transaction: another device may have skipped
          // already, and the turn must move exactly once.
          g.turn === game.turn ? rules.skipDepartedTurn(g, departedIds) : { patch: {} }
        )));
      }
      return;
    }

    if (view === 'vote') {
      if (!rules.everyoneVoted(game, activeIds)) return;
      const { caught } = rules.tallyVotes(game.votes);
      // Only the accused player's own device knows whether they are the fake,
      // and nobody else can find out without the reveal that has not happened
      // yet — so the accused decides what comes next. Everyone else waits.
      if (!caught || departedIds.includes(caught)) {
        // Nobody accused, or the accused has gone: a departed fake is not going
        // to steal, so any device can move the room on.
        setViewOnce(`toreveal:${caught ?? 'none'}`, 'reveal');
      } else if (caught === myPlayerId) {
        setViewOnce('accused', card?.isFake && mode.steal ? 'steal' : 'reveal');
      }
      return;
    }

    if (view === 'steal') {
      if (game.steal) { setViewOnce('stolen', 'reveal'); return; }
      // The fake IS the accused here, so their leaving is knowable without the
      // reveal — this is the one departure that would otherwise wedge the room
      // with nobody able to act.
      const { caught } = rules.tallyVotes(game.votes);
      if (caught && departedIds.includes(caught)) setViewOnce('stealgone', 'reveal');
      return;
    }

    if (view === 'reveal') {
      // Publish my own card and nothing else. See rules.publishCard.
      const mine = rules.revealCardFor(card);
      if (mine && !game.reveal?.[myPlayerId]) {
        once(`publish:${roundNumber}`, () => applyGame((g) => rules.publishCard(g, myPlayerId, mine)));
      }
      if (rules.everyoneRevealed(game, activeIds)) once('bank', () => finishRound());
    }
  }, [roomCode, state, game, myPlayerId, roster, once, applyGame, card, mode, roundNumber, finishRound]);

  const speakerId = game ? rules.currentSpeakerId(game) : null;

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
    mode,
    card,
    clues: game?.clues ?? [],
    votes: game?.votes ?? {},
    myVote: game?.votes?.[myPlayerId] ?? null,
    votedIds: Object.keys(game?.votes ?? {}),
    // Who the vote landed on. Public — every device can tally state/game/votes —
    // unlike `fakeId`, which needs the reveal.
    caught: game ? rules.tallyVotes(game.votes).caught : null,
    speakerId,
    speaker: players.find((p) => p.id === speakerId) ?? null,
    isMyTurn: Boolean(speakerId) && speakerId === myPlayerId,
    lap: game ? rules.lapOf(game) : 0,
    laps: game?.laps ?? 1,
    wordLimit: game?.wordLimit ?? 1,
    ...truth,
    // Who the round is still waiting on, rendered as names so a paused screen
    // says why rather than just sitting there.
    pendingNames: game
      ? rules.pendingVoters(game, core.activeIds).map(
        (id) => players.find((p) => p.id === id)?.name ?? id
      )
      : [],
    roundScores: game ? rules.scoreRound(game, truth) : {},
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    startGame, submitClue, castVote, submitSteal, guard,
  };
}
