import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import * as rules from '../rules';

// Which room this device is in, so a refresh / accidental tab close drops the
// player straight back into the game instead of the join screen. Firebase
// persists the anonymous uid itself, so the membership rules still pass.
const ROOM_KEY = 'aniguess_online_room';

// The state/ subtree a fresh AniGuess room starts with.
const initialState = (localProfile) => ({
  view: 'setup',
  hostId: localProfile.id,
  gameSession: { players: [localProfile], settings: null },
  assignmentIndex: 0,
  currentPlayerIndex: 0,
  lockedPositions: [],
  peekedPlayers: [],
  questionLogs: {},
  turnCounts: {},
  roundNumber: 1,
  totalScores: {},
  turnState: { pendingAction: null },
});

// Realtime Database doesn't store empty objects/arrays — a {} or [] written to
// a path simply doesn't exist on read-back. useRoomCore runs this at the single
// point state enters the hook, so every internal use (including passing straight
// into src/games/aniguess/rules.js) sees safe defaults rather than undefined.
const normalizeState = (val) => ({
  ...val,
  // Rooms created before the host role existed have no hostId node at all. Make
  // the absence explicit rather than undefined, so useRoomCore's fallback is the
  // single place that decides what "no crown" means — and so the migration
  // transaction has one value to CAS on.
  hostId: val.hostId ?? null,
  lockedPositions: val.lockedPositions ?? [],
  peekedPlayers: val.peekedPlayers ?? [],
  questionLogs: val.questionLogs ?? {},
  turnCounts: val.turnCounts ?? {},
  totalScores: val.totalScores ?? {},
  turnState: val.turnState ?? { pendingAction: null },
  lastOutcome: val.lastOutcome ?? null,
  // Same quirk: a room where nobody has written presence yet reads back with no
  // node at all.
  presence: val.presence ?? {},
  // Same quirk one level down: a player who joins with an empty list has no
  // animeList on read-back, and every consumer calls .reduce/.some on it
  // unguarded. Likewise a title with no characters.
  gameSession: val.gameSession && {
    ...val.gameSession,
    players: (val.gameSession.players ?? []).map((p) => ({
      ...p,
      animeList: (p.animeList ?? []).map((a) => ({
        ...a,
        characters: a.characters ?? [],
      })),
    })),
  },
});

// Mirrors useGameFlow.js's handler API, but persists via Firebase Realtime
// Database (update()/runTransaction()) instead of useState, and adds the
// multiplayer-only concepts (myPlayerId, isMyTurn/isMyAssignmentTurn, and the
// pendingAction redirect that keeps the guesser's own device from ever
// receiving their assigned character). Reuses the same pure src/games/aniguess/rules.js
// functions useGameFlow.js uses, so turn/scoring logic can't drift between
// local and online mode.
//
// The room lifecycle itself — codes, memberUids/claims/open, create/join, the
// state subscription, presence and host migration — lives in
// shared/hooks/useRoomCore.js and is shared with every other online game.
export function useRoom() {
  const [currentProposal, setCurrentProposal] = useState(null); // live shared pick for the current assignee

  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'gameSession/players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost,
    patchState, guard, bestEffort, once, setSyncError,
    rosterRef, roster,
  } = core;

  // readAssignment runs inside effects that deliberately don't re-subscribe on
  // every state change, so it reads the round through a ref instead of a dep.
  // useRoom's effects flush before those of the component calling it, so this
  // is up to date by the time any readAssignment caller runs.
  const roundRef = useRef(1);
  useEffect(() => { roundRef.current = state?.roundNumber ?? 1; }, [state?.roundNumber]);

  // During the assignment phase, non-assignee devices subscribe to the current
  // assignee's live proposal (stored in the secret assignments/{playerId} slot,
  // which the assignee's own device is denied from reading). The forRound stamp
  // filters out a prior round's locked pick so it doesn't linger as a stale
  // suggestion.
  useEffect(() => {
    const view = state?.view;
    const roundNumber = state?.roundNumber;
    const assignmentPlayer = state?.gameSession?.players?.[state?.assignmentIndex];
    // Only non-assignees during the assignment phase watch the live proposal.
    // (Bailing without a setState here keeps the effect body render-safe; the
    // cleanup below resets the proposal when we leave this phase — including
    // when the room goes away entirely and `view` becomes undefined.)
    if (view !== 'assignment' || !assignmentPlayer || assignmentPlayer.id === myPlayerId) return;
    const db = getFirebaseDb();
    const propRef = ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}`);
    const unsub = onValue(propRef, (snap) => {
      const v = snap.val();
      setCurrentProposal(v && v.forRound === roundNumber ? { character: v.character, by: v.by, approvals: v.approvals ?? {} } : null);
    });
    return () => { unsub(); setCurrentProposal(null); };
  }, [state?.view, state?.assignmentIndex, state?.roundNumber, state?.gameSession?.players, myPlayerId, roomCode]);

  // The one secrecy-sensitive path: written by whoever assigns (never the
  // assignee), read by whoever needs it to render Reveal/resolve a guess
  // (also never the assignee — enforced server-side by database.rules.json).
  // Assignments are overwritten, not cleared, between rounds, so the forRound
  // stamp is what makes a stale pick unreadable rather than silently wrong.
  const readAssignment = useCallback(async (playerId) => {
    const db = getFirebaseDb();
    const snap = await get(ref(db, `rooms/${roomCode}/assignments/${playerId}`));
    const v = snap.val();
    if (!v || v.forRound !== roundRef.current) return null;
    return v.character ?? null;
  }, [roomCode]);

  const handleStartGame = useCallback((session) => {
    // Guarded so only the host can start, even though the UI already hides the
    // control from everyone else — two devices starting at once would each deal
    // a different character pool from their own view of who is still here.
    if (!isHost) return Promise.resolve();
    const initial = rules.startGame(session);
    const db = getFirebaseDb();
    // Close the room to newcomers in the same breath as starting.
    return bestEffort(set(ref(db, `rooms/${roomCode}/open`), false))
      .then(() => patchState({
        gameSession: initial.gameSession,
        assignmentIndex: initial.assignmentIndex,
        currentPlayerIndex: initial.currentPlayerIndex,
        lockedPositions: initial.lockedPositions,
        peekedPlayers: initial.peekedPlayers,
        questionLogs: initial.questionLogs,
        turnCounts: initial.turnCounts,
        roundNumber: initial.roundNumber,
        totalScores: initial.totalScores,
        lastOutcome: null,
        view: 'assignment',
      }));
  }, [patchState, roomCode, bestEffort, isHost]);

  // Online "collective pick": every non-assignee shares ONE live proposal,
  // written to the secret assignments/{playerId} slot so the assignee can't see
  // it (the same rule that protects the final assignment). Anyone can propose or
  // overwrite it; everyone else sees it via the currentProposal subscription.
  const proposeCharacter = useCallback((character) => {
    const db = getFirebaseDb();
    const assignmentPlayer = state.gameSession.players[state.assignmentIndex];
    return guard(set(ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}`), {
      character,
      by: myPlayerId,
      forRound: state.roundNumber,
    }));
  }, [state, roomCode, myPlayerId, guard]);

  // The proposed character is already written — locking in just advances
  // everyone to the reveal step. Triggered automatically once every non-assignee
  // has approved (see OnlineGame), not by a manual button.
  const lockInAssignment = useCallback(() => patchState({ view: 'reveal' }), [patchState]);

  // Records (or clears) this device's approval of the current shared proposal.
  // Stored under the same assignee-locked slot, so it's wiped whenever
  // proposeCharacter overwrites the proposal — forcing everyone to re-approve a
  // changed pick.
  const setMyApproval = useCallback((approved) => {
    const db = getFirebaseDb();
    const assignmentPlayer = state.gameSession.players[state.assignmentIndex];
    return guard(set(ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}/approvals/${myPlayerId}`), approved ? true : null));
  }, [state, roomCode, myPlayerId, guard]);

  const handleRevealDone = useCallback(() => {
    const { patch, next } = rules.revealDone(state, rosterRef.current.departedIds);
    return patchState({ ...patch, view: next });
  }, [state, patchState, rosterRef]);

  // Unlike local play — where the whole table watches one screen — a remote
  // guesser's turn ends the moment they ask or guess, so the result would
  // scroll past unseen. lastOutcome is the shared "here's what just happened"
  // line every device shows until the next action replaces it.
  const outcomeFor = useCallback((logEntry) => {
    const player = state.gameSession.players[state.currentPlayerIndex];
    return {
      name: player.name,
      kind: logEntry.type,
      text: logEntry.text,
      answer: logEntry.answer ?? null,
      correct: logEntry.correct ?? null,
      at: Date.now(),
    };
  }, [state]);

  // The turn rotation skips anyone who has left — nobody can act on their
  // behalf, so landing on them would stall the room.
  const handleTurnComplete = useCallback((logEntry) => {
    const { patch } = rules.turnComplete(state, logEntry, rosterRef.current.departedIds);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor, rosterRef]);

  const handleCorrectGuess = useCallback((logEntry) => {
    const { patch } = rules.correctGuess(state, logEntry, rosterRef.current.departedIds);
    // The celebration screen says everything — no banner needed after it.
    return patchState({ ...patch, lastOutcome: null, view: 'correctGuess' });
  }, [state, patchState, rosterRef]);

  const handleWrongGuess = useCallback((logEntry) => {
    const { patch } = rules.wrongGuess(state, logEntry, rosterRef.current.departedIds);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor, rosterRef]);

  // Two different things want to fold lockedPositions into totalScores: a round
  // ending normally (finishRound) and a room emptying out mid-round (the
  // endSession hatch). Either can get there first, every device renders the
  // Continue button that triggers the former, and applyRoundScores is not
  // idempotent — so they have to be mutually exclusive, not merely ordered.
  //
  // Whoever commits this transaction owns the banking for that round; everyone
  // else skips it. Keyed by round number rather than a boolean so the next
  // round re-arms itself and nothing ever has to clear the marker.
  // Deliberately does NOT swallow a failed transaction: "somebody else is
  // banking this round" and "the write didn't happen" need different responses
  // from the callers, and conflating them silently loses a round's points.
  const claimRoundBanking = useCallback(async (roundNumber) => {
    if (roundNumber == null) return false;
    const db = getFirebaseDb();
    const res = await runTransaction(ref(db, `rooms/${roomCode}/state/bankedRound`), (cur) =>
      (cur === roundNumber ? undefined : roundNumber)
    );
    return res.committed;
  }, [roomCode]);

  const finishRound = useCallback((locked) => {
    // Guarding the whole sequence, not each write: if the claim throws we must
    // not move the room on, or the round would end with its points unbanked and
    // no way back to re-apply them.
    return guard((async () => {
      // Bank before moving the room on. Taking the claim first means a room
      // that empties out in this exact instant still lands on the right totals
      // — endSession finds the claim gone and leaves them alone.
      if (await claimRoundBanking(state.roundNumber)) {
        await patchState({ totalScores: rules.applyRoundScores(state.totalScores, locked) });
      }
      // Never drag the room back off the leaderboard: endSession may have ended
      // the session while we were banking, and once it has, its view wins. The
      // plain patch this replaced would have overwritten it and stranded
      // everyone on the round-end screen of a session that was already over.
      const db = getFirebaseDb();
      await runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
        (cur === 'leaderboard' ? undefined : 'roundEnd')
      );
    })());
  }, [state, patchState, roomCode, guard, claimRoundBanking]);

  const handlePeek = useCallback(() => {
    const player = state.gameSession.players[state.currentPlayerIndex];
    return patchState({ peekedPlayers: [...state.peekedPlayers, player.id] });
  }, [state, patchState]);

  // Host-only, and self-guarded for the same reason as handleStartGame: two
  // devices dealing a new round at once would each compute a different starting
  // index from their own view of who is still here, and the later write would
  // silently win.
  const handleNewRound = useCallback(() => {
    if (!isHost) return Promise.resolve();
    const { patch, next } = rules.newRound(state, rosterRef.current.departedIds);
    return patchState({ ...patch, lastOutcome: null, view: next });
  }, [state, patchState, isHost, rosterRef]);

  // Host-only: ending the session is irreversible for everyone in the room.
  // (Note this banks the win in *this* device's localStorage, so it's the host's
  // stats that record it — already true before, when it was whoever clicked.)
  const handleEndSession = useCallback((recordWin) => {
    if (!isHost) return Promise.resolve();
    const { winners } = rules.computeSessionEnd(state.totalScores, state.gameSession.players);
    winners.forEach((name) => recordWin(name));
    return patchState({ view: 'leaderboard' });
  }, [state, patchState, isHost]);

  // The guesser's device only ever writes raw text here — it never reads its
  // own assignment. Any other device resolves it (see resolvePendingAction).
  const submitPendingAction = useCallback((kind, text) => {
    const askedBy = state.gameSession.players[state.currentPlayerIndex].id;
    return patchState({ turnState: { pendingAction: { kind, text, askedBy, resolved: false } } });
  }, [state, patchState]);

  // Transaction-guarded so two answering devices can't both resolve the same
  // pending question/guess. Returns the pendingAction that was claimed, or
  // null if someone else already resolved it first (or the write failed).
  const resolvePendingAction = useCallback(async () => {
    const db = getFirebaseDb();
    const pendingRef = ref(db, `rooms/${roomCode}/state/turnState/pendingAction`);
    try {
      const result = await runTransaction(pendingRef, (current) => {
        if (!current || current.resolved) return; // abort
        return { ...current, resolved: true };
      });
      if (!result.committed) return null;
      return result.snapshot.val();
    } catch (e) {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
      return null;
    }
  }, [roomCode, setSyncError]);

  const clearPendingAction = useCallback(() => {
    return patchState({ turnState: { pendingAction: null } });
  }, [patchState]);

  const currentGuesser = state?.gameSession?.players?.[state.currentPlayerIndex];
  const assignmentPlayer = state?.gameSession?.players?.[state.assignmentIndex];
  const hasPeeked = state?.peekedPlayers?.includes(currentGuesser?.id) ?? false;
  const lastLocked = state?.lockedPositions?.[state.lockedPositions.length - 1];
  const isMyAssignmentTurn = myPlayerId != null && assignmentPlayer?.id === myPlayerId;
  const isMyTurn = myPlayerId != null && currentGuesser?.id === myPlayerId;

  // --- Departure reconciliation ----------------------------------------------
  //
  // useRoomCore has already moved the crown if the host went; what's left is the
  // AniGuess-specific half — which of *this game's* phases a departure can wedge.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Fewer than two players left is no longer a game. Ends the session on the
  // leaderboard, banking the in-progress round so the standings reflect where
  // it actually got to. claimRoundBanking is what stops the points being
  // applied twice — by a second device running this, or by a finishRound racing
  // it from the other direction.
  const endSession = useCallback(async () => {
    const snapshot = stateRef.current;
    const locked = snapshot?.lockedPositions ?? [];

    // Bank BEFORE flipping the view, so a failed claim can re-arm and retry
    // from a clean slate — once the room reads 'leaderboard' the transaction
    // below aborts forever, and a retry could never bank the round at all.
    //
    // Claiming rather than assuming this round is unbanked: a room sitting on
    // the round-end screen has already had its points applied by finishRound,
    // and host-gated round ends made that the common case, since the room now
    // waits there for the host rather than for whoever clicks first. Losing the
    // claim means someone else has it covered, so leave the totals alone.
    let claimed = false;
    try {
      claimed = locked.length > 0 && await claimRoundBanking(snapshot?.roundNumber);
    } catch {
      return false; // transient — the view is untouched, so a retry is clean
    }
    if (claimed) {
      await patchState({
        totalScores: rules.applyRoundScores(snapshot.totalScores ?? {}, locked),
        lockedPositions: [],
      });
    }

    const db = getFirebaseDb();
    const res = await runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
      (cur === 'leaderboard' ? undefined : 'leaderboard')
    ).catch(() => null);
    if (!res) return false; // transient failure — try again on a later render
    return true;
  }, [roomCode, patchState, claimRoundBanking]);

  useEffect(() => {
    if (!roomCode || !state || !myPlayerId) return;
    const { activeIds, departedIds } = roster;
    const active = roster.active;
    const view = state.view;

    if (!view || view === 'setup' || view === 'leaderboard') return;

    if (active.length < 2) {
      once(`end:${view}`, () => endSession());
      return;
    }

    // Choosing a character for someone who isn't there to guess it is wasted
    // effort, and the assignee's own device is the only one that can move the
    // reveal along on their behalf.
    if (view === 'assignment' || view === 'reveal') {
      const assignee = state.gameSession?.players?.[state.assignmentIndex];
      if (assignee && departedIds.includes(assignee.id)) {
        once(`assign:${state.roundNumber}:${state.assignmentIndex}`, () => {
          const { patch, next } = rules.skipDepartedAssignment(state, departedIds);
          if (!next) return;
          return patchState({ ...patch, view: next });
        });
      }
      return;
    }

    if (view === 'game') {
      // Only the guesser's own device can ask or guess, so their turn has to
      // pass on without them.
      const guesser = state.gameSession?.players?.[state.currentPlayerIndex];
      if (guesser && departedIds.includes(guesser.id)) {
        once(`turn:${state.roundNumber}:${state.currentPlayerIndex}:${activeIds.join(',')}`, () => {
          const { patch } = rules.skipDepartedTurn(state, departedIds);
          if (!Object.keys(patch).length) return;
          return patchState(patch);
        });
        return;
      }

      // A question left hanging by someone who has since gone can never be
      // answered to them; clear it so the room isn't stuck on "waiting".
      const pending = state.turnState?.pendingAction;
      if (pending && !pending.resolved && departedIds.includes(pending.askedBy)) {
        once(`pending:${state.roundNumber}:${pending.askedBy}:${pending.text}`,
          () => clearPendingAction());
      }
    }
  }, [
    roomCode, state, myPlayerId, roster,
    once, patchState, clearPendingAction, endSession,
  ]);

  return {
    uid: core.uid, roomCode, myPlayerId,
    error: core.error, syncError: core.syncError,
    dismissError: core.dismissError, dismissSyncError: core.dismissSyncError,
    createRoom: core.createRoom, joinRoom: core.joinRoom, leaveRoom: core.leaveRoom,
    updateMyProfile: core.updateMyProfile, setView: core.setView,
    view: state?.view,
    hostId: core.hostId, isHost, hostName: core.hostName,
    gameSession: state?.gameSession,
    assignmentIndex: state?.assignmentIndex,
    currentPlayerIndex: state?.currentPlayerIndex,
    lockedPositions: state?.lockedPositions ?? [],
    peekedPlayers: state?.peekedPlayers ?? [],
    questionLogs: state?.questionLogs ?? {},
    turnCounts: state?.turnCounts ?? {},
    roundNumber: state?.roundNumber,
    totalScores: state?.totalScores ?? {},
    pendingAction: state?.turnState?.pendingAction ?? null,
    lastOutcome: state?.lastOutcome ?? null,
    currentProposal,
    currentGuesser, assignmentPlayer, hasPeeked, lastLocked,
    isMyAssignmentTurn, isMyTurn,
    // The roster minus anyone who left or timed out. Components should count
    // these, not gameSession.players, for anything the room has to wait on.
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    handleStartGame, proposeCharacter, lockInAssignment, setMyApproval, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    submitPendingAction, resolvePendingAction, clearPendingAction,
    readAssignment,
  };
}
