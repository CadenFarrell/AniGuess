import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, update, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb, ensureSignedIn } from '../../../shared/services/firebase';
import * as rules from '../rules';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// Mirrors useGameFlow.js's handler API, but persists via Firebase Realtime
// Database (update()/runTransaction()) instead of useState, and adds the
// multiplayer-only concepts (myPlayerId, isMyTurn/isMyAssignmentTurn, and the
// pendingAction redirect that keeps the guesser's own device from ever
// receiving their assigned character). Reuses the same pure src/games/aniguess/rules.js
// functions useGameFlow.js uses, so turn/scoring logic can't drift between
// local and online mode.
export function useRoom() {
  const [uid, setUid] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [state, setState] = useState(null); // /rooms/{code}/state subtree
  const [currentProposal, setCurrentProposal] = useState(null); // live shared pick for the current assignee
  const [error, setError] = useState('');

  useEffect(() => {
    ensureSignedIn().then(setUid).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const db = getFirebaseDb();
    const stateRef = ref(db, `rooms/${roomCode}/state`);
    const unsubscribe = onValue(stateRef, (snap) => {
      const val = snap.val();
      // Realtime Database doesn't store empty objects/arrays — a {} or []
      // written to a path simply doesn't exist on read-back. Normalize here,
      // at the single point state enters the hook, so every internal use
      // (including passing straight into src/games/aniguess/rules.js) sees safe
      // defaults rather than undefined.
      setState(val ? {
        ...val,
        lockedPositions: val.lockedPositions ?? [],
        peekedPlayers: val.peekedPlayers ?? [],
        questionLogs: val.questionLogs ?? {},
        turnCounts: val.turnCounts ?? {},
        totalScores: val.totalScores ?? {},
        turnState: val.turnState ?? { pendingAction: null },
      } : val);
    });
    return () => unsubscribe();
  }, [roomCode]);

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
    // cleanup below resets the proposal when we leave this phase.)
    if (view !== 'assignment' || !assignmentPlayer || assignmentPlayer.id === myPlayerId) return;
    const db = getFirebaseDb();
    const propRef = ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}`);
    const unsub = onValue(propRef, (snap) => {
      const v = snap.val();
      setCurrentProposal(v && v.forRound === roundNumber ? { character: v.character, by: v.by, approvals: v.approvals ?? {} } : null);
    });
    return () => { unsub(); setCurrentProposal(null); };
  }, [state?.view, state?.assignmentIndex, state?.roundNumber, state?.gameSession?.players, myPlayerId, roomCode]);

  const createRoom = useCallback(async (localProfile) => {
    const db = getFirebaseDb();
    let code = null;
    for (let attempt = 0; attempt < 6 && !code; attempt++) {
      const candidate = generateRoomCode();
      const result = await runTransaction(ref(db, `rooms/${candidate}/createdAt`), (current) => {
        if (current !== null) return; // abort — code already taken
        return Date.now();
      });
      if (result.committed) code = candidate;
    }
    if (!code) throw new Error('Could not create a room — please try again.');

    // Firebase evaluates each path's rule in a multi-location update() against
    // the pre-update tree, not the merged result — so writing memberUids and
    // claims/state (whose rules depend on memberUids already existing) in one
    // batch fails. Write memberUids first and await it so the dependent
    // writes see it as already-committed.
    const playerId = localProfile.id;
    await update(ref(db), { [`rooms/${code}/memberUids/${uid}`]: playerId });
    await update(ref(db), {
      [`rooms/${code}/claims/${playerId}`]: uid,
      [`rooms/${code}/state`]: {
        view: 'setup',
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
      },
    });
    setRoomCode(code);
    setMyPlayerId(playerId);
    return code;
  }, [uid]);

  const joinRoom = useCallback(async (rawCode, localProfile) => {
    const db = getFirebaseDb();
    const code = rawCode.trim().toUpperCase();
    const createdSnap = await get(ref(db, `rooms/${code}/createdAt`));
    if (!createdSnap.exists()) throw new Error(`Room "${code}" not found.`);

    const playerId = localProfile.id;
    await update(ref(db), { [`rooms/${code}/memberUids/${uid}`]: playerId });
    await update(ref(db), { [`rooms/${code}/claims/${playerId}`]: uid });

    const playersSnap = await get(ref(db, `rooms/${code}/state/gameSession/players`));
    const players = playersSnap.val() || [];
    if (!players.some((p) => p.id === playerId)) {
      await update(ref(db, `rooms/${code}/state/gameSession`), { players: [...players, localProfile] });
    }
    setRoomCode(code);
    setMyPlayerId(playerId);
  }, [uid]);

  const leaveRoom = useCallback(() => {
    setRoomCode(null);
    setMyPlayerId(null);
    setState(null);
  }, []);

  const patchState = useCallback((patch) => {
    if (!roomCode) return Promise.resolve();
    const db = getFirebaseDb();
    const updates = {};
    for (const [key, value] of Object.entries(patch)) {
      updates[`rooms/${roomCode}/state/${key}`] = value;
    }
    return update(ref(db), updates);
  }, [roomCode]);

  const setView = useCallback((view) => patchState({ view }), [patchState]);

  // The one secrecy-sensitive path: written by whoever assigns (never the
  // assignee), read by whoever needs it to render Reveal/resolve a guess
  // (also never the assignee — enforced server-side by database.rules.json).
  const writeAssignment = useCallback((playerId, character) => {
    const db = getFirebaseDb();
    return set(ref(db, `rooms/${roomCode}/assignments/${playerId}`), { character });
  }, [roomCode]);

  const readAssignment = useCallback(async (playerId) => {
    const db = getFirebaseDb();
    const snap = await get(ref(db, `rooms/${roomCode}/assignments/${playerId}`));
    return snap.val()?.character ?? null;
  }, [roomCode]);

  const handleStartGame = useCallback((session) => {
    const initial = rules.startGame(session);
    return patchState({
      gameSession: initial.gameSession,
      assignmentIndex: initial.assignmentIndex,
      currentPlayerIndex: initial.currentPlayerIndex,
      lockedPositions: initial.lockedPositions,
      peekedPlayers: initial.peekedPlayers,
      questionLogs: initial.questionLogs,
      turnCounts: initial.turnCounts,
      roundNumber: initial.roundNumber,
      totalScores: initial.totalScores,
      view: 'assignment',
    });
  }, [patchState]);

  // Online "collective pick": every non-assignee shares ONE live proposal,
  // written to the secret assignments/{playerId} slot so the assignee can't see
  // it (the same rule that protects the final assignment). Anyone can propose or
  // overwrite it; everyone else sees it via the currentProposal subscription.
  const proposeCharacter = useCallback((character) => {
    const db = getFirebaseDb();
    const assignmentPlayer = state.gameSession.players[state.assignmentIndex];
    return set(ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}`), {
      character,
      by: myPlayerId,
      forRound: state.roundNumber,
    });
  }, [state, roomCode, myPlayerId]);

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
    return set(ref(db, `rooms/${roomCode}/assignments/${assignmentPlayer.id}/approvals/${myPlayerId}`), approved ? true : null);
  }, [state, roomCode, myPlayerId]);

  const handleRevealDone = useCallback(() => {
    const { patch, next } = rules.revealDone(state);
    return patchState({ ...patch, view: next });
  }, [state, patchState]);

  const handleTurnComplete = useCallback((logEntry) => {
    const { patch } = rules.turnComplete(state, logEntry);
    return patchState(patch);
  }, [state, patchState]);

  const handleCorrectGuess = useCallback((logEntry) => {
    const { patch } = rules.correctGuess(state, logEntry);
    return patchState({ ...patch, view: 'correctGuess' });
  }, [state, patchState]);

  const handleWrongGuess = useCallback((logEntry) => {
    const { patch } = rules.wrongGuess(state, logEntry);
    return patchState(patch);
  }, [state, patchState]);

  const finishRound = useCallback((locked) => {
    return patchState({ totalScores: rules.applyRoundScores(state.totalScores, locked), view: 'roundEnd' });
  }, [state, patchState]);

  const handlePeek = useCallback(() => {
    const player = state.gameSession.players[state.currentPlayerIndex];
    return patchState({ peekedPlayers: [...state.peekedPlayers, player.id] });
  }, [state, patchState]);

  const handleNewRound = useCallback(() => {
    const { patch, next } = rules.newRound(state);
    return patchState({ ...patch, view: next });
  }, [state, patchState]);

  const handleEndSession = useCallback((recordWin) => {
    const { winners } = rules.computeSessionEnd(state.totalScores, state.gameSession.players);
    winners.forEach((name) => recordWin(name));
    return patchState({ view: 'leaderboard' });
  }, [state, patchState]);

  // The guesser's device only ever writes raw text here — it never reads its
  // own assignment. Any other device resolves it (see resolvePendingAction).
  const submitPendingAction = useCallback((kind, text) => {
    const askedBy = state.gameSession.players[state.currentPlayerIndex].id;
    return patchState({ turnState: { pendingAction: { kind, text, askedBy, resolved: false } } });
  }, [state, patchState]);

  // Transaction-guarded so two answering devices can't both resolve the same
  // pending question/guess. Returns the pendingAction that was claimed, or
  // null if someone else already resolved it first.
  const resolvePendingAction = useCallback(async () => {
    const db = getFirebaseDb();
    const pendingRef = ref(db, `rooms/${roomCode}/state/turnState/pendingAction`);
    const result = await runTransaction(pendingRef, (current) => {
      if (!current || current.resolved) return; // abort
      return { ...current, resolved: true };
    });
    if (!result.committed) return null;
    return result.snapshot.val();
  }, [roomCode]);

  const clearPendingAction = useCallback(() => {
    return patchState({ turnState: { pendingAction: null } });
  }, [patchState]);

  const currentGuesser = state?.gameSession?.players?.[state.currentPlayerIndex];
  const assignmentPlayer = state?.gameSession?.players?.[state.assignmentIndex];
  const hasPeeked = state?.peekedPlayers?.includes(currentGuesser?.id) ?? false;
  const lastLocked = state?.lockedPositions?.[state.lockedPositions.length - 1];
  const isMyAssignmentTurn = myPlayerId != null && assignmentPlayer?.id === myPlayerId;
  const isMyTurn = myPlayerId != null && currentGuesser?.id === myPlayerId;

  return {
    uid, roomCode, myPlayerId, error,
    createRoom, joinRoom, leaveRoom, setView,
    view: state?.view,
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
    currentProposal,
    currentGuesser, assignmentPlayer, hasPeeked, lastLocked,
    isMyAssignmentTurn, isMyTurn,
    handleStartGame, proposeCharacter, lockInAssignment, setMyApproval, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    submitPendingAction, resolvePendingAction, clearPendingAction,
    writeAssignment, readAssignment,
  };
}
