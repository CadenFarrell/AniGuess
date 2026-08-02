import { useState, useEffect, useCallback } from 'react';
import { ref, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { prepareQuestions } from '../services/buildQuestions';
import * as rules from '../rules';

// Which room this device is in, so a refresh drops the player straight back into
// the game instead of the join screen. Firebase persists the anonymous uid, so
// the membership rules still pass. Separate key from AniGuess's so the two games'
// saved rooms don't clobber each other.
const ROOM_KEY = 'anitune_online_room';
// Lead time between "everyone's ready" and the synchronized clip start, giving
// every device a moment to schedule playback off the shared timestamp.
const COUNTDOWN_MS = 3000;

// The state/ subtree a fresh AniTune room starts with.
const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  mode: null,
  settings: null,
  round: null,
  game: null,
  players: [localProfile],
});

// Realtime Database drops empty objects/arrays on read-back, and transaction
// callbacks see the raw stored value — so normalize the round-state object at
// every point it enters the hook (useRoomCore's subscription AND the
// transactions below) before handing it to the pure rules, which call
// .includes/.every on these unguarded.
function normalizeGame(game) {
  if (!game) return game ?? null;
  return {
    ...game,
    scores: game.scores ?? {},
    lockedOut: game.lockedOut ?? [],
    entryOrder: game.entryOrder ?? [],
    answers: game.answers ?? {},
    ready: game.ready ?? {},
    buzzedBy: game.buzzedBy ?? null,
    clipStartAt: game.clipStartAt ?? null,
  };
}

const normalizeState = (val) => ({
  view: val.view,
  hostId: val.hostId ?? null,
  mode: val.mode ?? null,
  settings: val.settings ?? null,
  round: val.round ?? null,
  // Same empty-collection quirk: a room where nobody has written presence yet
  // reads back with no node at all.
  presence: val.presence ?? {},
  // Same empty-collection quirk one level down: a player who joins with an
  // empty list has no animeList on read-back, and prepareQuestions iterates it
  // unguarded.
  players: (val.players ?? []).map((p) => ({
    ...p,
    animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
  })),
  game: normalizeGame(val.game),
});

// The Firebase-backed twin of useAniTuneRound: same idea (the pure rules.js
// functions decide what happens, this only decides where the state lives), but
// persisted to Realtime Database so every device shares one round.
//
// The room lifecycle itself — codes, memberUids/claims/open, create/join, the
// state subscription, presence and host migration — lives in
// shared/hooks/useRoomCore.js and is shared with every other online game. What's
// left here is what makes AniTune AniTune: the buzz race (a transaction, so
// first-to-buzz wins fairly), the concurrent simultaneous submit, and the
// synchronized clip start.
export function useAniTuneRoom() {
  const [isPreparing, setIsPreparing] = useState(false); // this device is building the round
  const [prepProgress, setPrepProgress] = useState(null);

  // A host who leaves the room mid-prepare would otherwise keep these set, and
  // the lobby would render "finding songs…" forever. Not derived from room
  // state, so useRoomCore can't clear them for us.
  const onExitRoom = useCallback(() => {
    setIsPreparing(false);
    setPrepProgress(null);
  }, []);

  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
    onExitRoom,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, guard, bestEffort, once, setSyncError,
    roster, rosterRef, serverOffsetRef,
  } = core;

  // Back to the lobby to play again with the same group — clears the finished
  // round and reopens the room so someone new can still join between games.
  const returnToLobby = useCallback(async () => {
    const db = getFirebaseDb();
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    return patchState({ view: 'lobby', round: null, game: null });
  }, [roomCode, patchState, bestEffort]);

  // Every game action funnels through one transaction on state/game so
  // concurrent devices can't lose each other's writes. The pure rule decides the
  // patch; an empty patch (a no-op guard tripping) aborts the transaction.
  const applyGame = useCallback((fn) => {
    const db = getFirebaseDb();
    const gameRef = ref(db, `rooms/${roomCode}/state/game`);
    return runTransaction(gameRef, (raw) => {
      const game = normalizeGame(raw);
      if (!game) return; // abort — no round yet
      const { patch } = fn(game);
      if (!patch || Object.keys(patch).length === 0) return; // abort — rule no-op
      return { ...game, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, [roomCode, setSyncError]);

  // The host prepares the round (the slow networked part) and publishes it so
  // every device deals identical clips. Others just watch the view flip to
  // 'preparing' then 'round'. Guarded so only the host can start, even though the
  // UI already hides the control from everyone else.
  const startGame = useCallback(async (settings) => {
    if (!isHost) return;
    // Deal from the players actually here — a departed player's anime list
    // shouldn't shape the round, least of all under "shared songs only".
    const dealtIn = rosterRef.current.active;
    const db = getFirebaseDb();
    setIsPreparing(true);
    setPrepProgress({ phase: 'resolving', done: 0, total: dealtIn.length });
    try {
      await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
      await patchState({ view: 'preparing', mode: settings.mode, settings });

      const { round, unresolved, themeless } = await prepareQuestions(dealtIn, {
        sharedSongsOnly: settings.sharedSongsOnly,
        includeOpenings: settings.includeOpenings,
        includeEndings: settings.includeEndings,
        roundSize: settings.roundSize,
        onProgress: setPrepProgress,
      });

      if (!round.length) {
        const skipped = unresolved.length + themeless.length;
        setSyncError(
          skipped
            ? `No playable songs found. ${skipped} show${skipped === 1 ? '' : 's'} had no themes on AnimeThemes.`
            : 'No playable songs found for these settings.'
        );
        await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
        await patchState({ view: 'lobby' });
        return;
      }

      // A shared per-question offset fraction so every device seeks to the same
      // musical moment (ClipPlayer's own random offset would desync them).
      const withFractions = round.map((q) => ({ ...q, clipFraction: 0.2 + Math.random() * 0.5 }));
      await patchState({
        round: withFractions,
        game: rules.startRound(dealtIn, settings.mode),
        view: 'round',
      });
    } catch (e) {
      setSyncError(e?.message || 'Something went wrong preparing the game.');
      await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
      await patchState({ view: 'lobby' });
    } finally {
      setIsPreparing(false);
      setPrepProgress(null);
    }
  }, [isHost, roomCode, patchState, bestEffort, rosterRef, setSyncError]);

  // --- Per-question clip sync ---

  // This device is set to hear the clip: unlocked its audio and buffered it.
  const markReady = useCallback(() => {
    const db = getFirebaseDb();
    return guard(set(ref(db, `rooms/${roomCode}/state/game/ready/${myPlayerId}`), true));
  }, [roomCode, myPlayerId, guard]);

  // Once everyone is ready, one device stamps the shared start time. Transaction
  // so only the first stamp sticks; the rest see a non-null value and abort.
  const setClipStart = useCallback(() => {
    const db = getFirebaseDb();
    const target = Date.now() + serverOffsetRef.current + COUNTDOWN_MS;
    return guard(runTransaction(ref(db, `rooms/${roomCode}/state/game/clipStartAt`), (cur) =>
      cur == null ? target : undefined
    ));
  }, [roomCode, guard, serverOffsetRef]);

  // --- Race ---

  const buzz = useCallback(() => applyGame((game) => rules.buzz(game, myPlayerId)), [applyGame, myPlayerId]);

  const resolveBuzz = useCallback((question, guess) => applyGame((game) => {
    // Only the buzzer resolves, and only while still buzzed — guards a stale tap.
    if (game.phase !== 'buzzed' || game.buzzedBy !== myPlayerId) return { patch: {} };
    // Active roster: a wrong buzz should reveal once everyone *still here* is
    // locked out, not wait on players who have gone.
    return rules.resolveBuzz(game, question, guess, rosterRef.current.active);
  }), [applyGame, myPlayerId, rosterRef]);

  const giveUp = useCallback(() => applyGame((game) => rules.giveUp(game)), [applyGame]);

  // --- Simultaneous ---

  const submitAnswer = useCallback((question, text) => applyGame((game) =>
    rules.submitOnlineAnswer(game, question, myPlayerId, text, rosterRef.current.activeIds)
  ), [applyGame, myPlayerId, rosterRef]);

  const revealNow = useCallback(() => applyGame((game) => rules.revealNow(game)), [applyGame]);

  // --- Advancement ---

  // Idempotent against everyone tapping "Next": the transaction only advances
  // from a 'revealed' phase, and a finished round is parked at phase 'finished'
  // so a second device can't re-advance past the end.
  const advance = useCallback(async () => {
    const db = getFirebaseDb();
    const roundLength = state?.round?.length ?? 0;
    const res = await runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const game = normalizeGame(raw);
      if (!game || game.phase !== 'revealed') return; // abort
      const { finished, patch } = rules.nextQuestion(game, players, roundLength);
      if (finished) return { ...game, phase: 'finished' };
      return { ...game, ...patch, ready: null, clipStartAt: null };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
      return null;
    });
    if (res?.committed && res.snapshot.val()?.phase === 'finished') {
      await patchState({ view: 'results' });
    }
  }, [roomCode, players, state?.round?.length, patchState, setSyncError]);

  // Cut the match short — the room has dropped below two players, so there's no
  // game left to play. Parks the round at 'finished' the same way advance()
  // does, so the results screen shows the scores as they stood.
  const endMatch = useCallback(async () => {
    const db = getFirebaseDb();
    const res = await runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = normalizeGame(raw);
      if (!current || current.phase === 'finished') return; // abort
      return { ...current, phase: 'finished' };
    }).catch(() => null);

    // The write itself failed — say so rather than guessing at the room's
    // state, because the fallback below would throw away a live round.
    if (!res) return false;

    if (res.snapshot?.val()?.phase === 'finished') {
      await patchState({ view: 'results' });
      return true;
    }
    // The transaction aborted with nothing there: no round was ever dealt (the
    // host vanished while finding songs), so there are no scores to show.
    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
    await patchState({ view: 'lobby', round: null, game: null });
    return true;
  }, [roomCode, patchState, bestEffort]);

  const game = state?.game ?? null;
  const playerIds = players.map((p) => p.id);
  // Every gate below counts the *active* roster, not everyone who ever joined:
  // a player who closed their tab will never write `ready` or an answer, and
  // waiting on them would freeze the room for good.
  const allReady =
    roster.active.length > 0 && game != null && roster.active.every((p) => game.ready?.[p.id]);
  const iAmReady = Boolean(game?.ready?.[myPlayerId]);
  const isMyBuzz = game?.buzzedBy != null && game.buzzedBy === myPlayerId;
  const iHaveAnswered = Boolean(game?.answers?.[myPlayerId]);

  // --- Departure reconciliation ----------------------------------------------
  //
  // useRoomCore has already moved the crown if the host went; what's left is the
  // AniTune-specific half — which of *this game's* phases a departure can wedge.
  // Nothing above notices a departure on its own; these checks do. Any device
  // may run them — every action is a transaction that aborts if someone else
  // got there first — and the one-shot keys stop a single device retrying on
  // every render. Keys fold in the question index and the active roster, so a
  // rejoin followed by a fresh departure re-arms them.
  useEffect(() => {
    if (!roomCode || !state || !myPlayerId) return;
    const { active, activeIds } = roster;
    const view = state.view;
    const g = state.game;

    // The host builds the round on their own device, so if they vanish
    // mid-build nobody else has the questions. Whoever inherits the crown
    // resets the room rather than leaving everyone on "Host is finding songs…".
    if (view === 'preparing' && isHost && !isPreparing && active.length >= 2) {
      once(`preparing-orphan:${state.hostId}`, async () => {
        const db = getFirebaseDb();
        await bestEffort(set(ref(db, `rooms/${roomCode}/open`), true));
        await patchState({ view: 'lobby' });
        setSyncError('The host left while finding songs — start the game again when you’re ready.');
      });
    }

    // Below two players there's no game left. Covers 'preparing' too, where
    // endMatch falls back to the lobby because no round exists yet.
    if ((view === 'round' || view === 'preparing') && active.length < 2) {
      once(`end:${view}`, () => endMatch());
    } else if (view === 'round' && g && g.phase !== 'finished') {
      // Only the buzzer can resolve their own buzz, so if they walk away the
      // clip stays paused for everyone else until the question is handed back.
      if (g.phase === 'buzzed' && g.buzzedBy && !activeIds.includes(g.buzzedBy)) {
        once(`release:${g.index}:${g.buzzedBy}`, () =>
          applyGame((cur) => rules.releaseBuzz(cur, g.buzzedBy)));
      }

      // Everyone still here has locked in, but a departed player's empty slot
      // would hold the reveal open — and nobody is rendering "Reveal now" once
      // they've all answered.
      if (g.mode !== rules.RACE && g.phase !== 'revealed'
          && activeIds.length > 0 && activeIds.every((id) => g.answers?.[id])) {
        once(`reveal:${g.index}:${activeIds.join(',')}`, () => revealNow());
      }

      // Everyone still here is locked out, so nobody can answer this one.
      if (g.mode === rules.RACE && g.phase === 'listening'
          && rules.everyoneLockedOut(active, g.lockedOut ?? [])) {
        once(`giveup:${g.index}:${activeIds.join(',')}`, () => giveUp());
      }
    }

    // advance() parks the round at 'finished' and then writes the results view
    // in a second, non-transactional step. If that device drops in between, the
    // room is stranded on a finished round — any device can close the gap.
    if (g?.phase === 'finished' && view !== 'results') {
      once('finished-results', () => patchState({ view: 'results' }));
    }
  }, [
    roomCode, state, myPlayerId, roster, isHost, isPreparing,
    once, applyGame, revealNow, giveUp, patchState, bestEffort, endMatch, setSyncError,
  ]);

  return {
    uid: core.uid, roomCode, myPlayerId,
    error: core.error, syncError: core.syncError,
    dismissError: core.dismissError, dismissSyncError: core.dismissSyncError,
    createRoom: core.createRoom, joinRoom: core.joinRoom, leaveRoom: core.leaveRoom,
    updateMyProfile: core.updateMyProfile, setView: core.setView, returnToLobby,
    isPreparing, prepProgress, serverOffset: core.serverOffset,
    view: state?.view,
    hostId: core.hostId, isHost,
    mode: state?.mode ?? null,
    settings: state?.settings ?? null,
    players,
    playerIds,
    // The roster minus anyone who left or timed out. Components should count
    // these, not `players`, for anything the room has to wait on.
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    round: state?.round ?? null,
    game,
    allReady, iAmReady, isMyBuzz, iHaveAnswered,
    startGame,
    markReady, setClipStart,
    buzz, resolveBuzz, giveUp,
    submitAnswer, revealNow,
    advance,
  };
}
