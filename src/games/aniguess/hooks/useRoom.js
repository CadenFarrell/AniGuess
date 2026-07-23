import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, update, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb, ensureSignedIn } from '../../../shared/services/firebase';
import { storage } from '../../../shared/services/storage';
import * as rules from '../rules';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
// Which room this device is in, so a refresh / accidental tab close drops the
// player straight back into the game instead of the join screen. Firebase
// persists the anonymous uid itself, so the membership rules still pass.
const ROOM_KEY = 'aniguess_online_room';

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
  const [error, setError] = useState(''); // fatal: can't reach Firebase at all
  const [syncError, setSyncError] = useState(''); // transient: a write failed

  // readAssignment runs inside effects that deliberately don't re-subscribe on
  // every state change, so it reads the round through a ref instead of a dep.
  // useRoom's effects flush before those of the component calling it, so this
  // is up to date by the time any readAssignment caller runs.
  const roundRef = useRef(1);
  useEffect(() => { roundRef.current = state?.roundNumber ?? 1; }, [state?.roundNumber]);

  const forgetSavedRoom = useCallback(() => storage.removeItem(ROOM_KEY), []);

  const exitRoom = useCallback(() => {
    forgetSavedRoom();
    setRoomCode(null);
    setMyPlayerId(null);
    setState(null);
    setCurrentProposal(null);
  }, [forgetSavedRoom]);

  // Sign in, then restore a saved room if there is one.
  const restoredRef = useRef(false);
  useEffect(() => {
    ensureSignedIn()
      .then((u) => {
        setUid(u);
        if (restoredRef.current) return;
        restoredRef.current = true;
        const saved = storage.getItem(ROOM_KEY);
        if (saved?.roomCode && saved?.playerId) {
          setRoomCode(saved.roomCode);
          setMyPlayerId(saved.playerId);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return;
    const db = getFirebaseDb();
    const stateRef = ref(db, `rooms/${roomCode}/state`);
    const unsubscribe = onValue(
      stateRef,
      (snap) => {
        const val = snap.val();
        if (!val) {
          // The room was deleted (or a saved code went stale) — don't strand
          // the player on a loading screen.
          exitRoom();
          setError('That room no longer exists. Create or join another one.');
          return;
        }
        // Realtime Database doesn't store empty objects/arrays — a {} or []
        // written to a path simply doesn't exist on read-back. Normalize here,
        // at the single point state enters the hook, so every internal use
        // (including passing straight into src/games/aniguess/rules.js) sees safe
        // defaults rather than undefined.
        setState({
          ...val,
          lockedPositions: val.lockedPositions ?? [],
          peekedPlayers: val.peekedPlayers ?? [],
          questionLogs: val.questionLogs ?? {},
          turnCounts: val.turnCounts ?? {},
          totalScores: val.totalScores ?? {},
          turnState: val.turnState ?? { pendingAction: null },
          lastOutcome: val.lastOutcome ?? null,
          // Same quirk one level down: a player who joins with an empty list
          // has no animeList on read-back, and every consumer calls
          // .reduce/.some on it unguarded. Likewise a title with no characters.
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
      },
      () => {
        // Permission denied — usually a saved room this device's uid no longer
        // has membership in (browser storage cleared, different profile).
        exitRoom();
        setError('Lost access to that room. Rejoin with the room code.');
      }
    );
    return () => unsubscribe();
  }, [roomCode, exitRoom]);

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

  // Every mutation funnels through here so a rejected/offline write surfaces in
  // the UI instead of becoming a silent unhandled rejection.
  const guard = useCallback((promise) => {
    return Promise.resolve(promise).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, []);

  const dismissSyncError = useCallback(() => setSyncError(''), []);

  // The `open` flag and the pre-join `claims` read both depend on rules added
  // in database.rules.json after the first release. Until those are deployed
  // the paths are denied, so treat a failure as "unknown" and fall back to the
  // older, more permissive behaviour instead of blocking play outright.
  const bestEffort = useCallback(async (promise, fallback = undefined) => {
    try {
      return await promise;
    } catch {
      return fallback;
    }
  }, []);

  const rememberRoom = useCallback((code, playerId) => {
    storage.setItem(ROOM_KEY, { roomCode: code, playerId });
  }, []);

  const createRoom = useCallback(async (localProfile) => {
    // Both entry points may be clicked before anonymous sign-in has resolved;
    // without this the writes below would build a `.../memberUids/null` path.
    const myUid = uid ?? await ensureSignedIn();
    if (myUid !== uid) setUid(myUid);

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
    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    await update(ref(db), {
      [`rooms/${code}/claims/${playerId}`]: myUid,
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
    await bestEffort(set(ref(db, `rooms/${code}/open`), true));
    rememberRoom(code, playerId);
    setRoomCode(code);
    setMyPlayerId(playerId);
    return code;
  }, [uid, rememberRoom, bestEffort]);

  const joinRoom = useCallback(async (rawCode, localProfile) => {
    const myUid = uid ?? await ensureSignedIn();
    if (myUid !== uid) setUid(myUid);

    const db = getFirebaseDb();
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new Error('Room codes are 5 letters/numbers.');
    const createdSnap = await get(ref(db, `rooms/${code}/createdAt`));
    if (!createdSnap.exists()) throw new Error(`Room "${code}" not found.`);

    const playerId = localProfile.id;

    // Player ids are derived from the name, so two different people using the
    // same name would silently share one slot. Check the claim BEFORE writing
    // memberUids — that mapping is write-once, so a wrong guess here would
    // lock this device out of the room for good.
    const claimSnap = await bestEffort(get(ref(db, `rooms/${code}/claims/${playerId}`)));
    const claimedBy = claimSnap?.val() ?? null;
    const isRejoin = claimedBy === myUid;
    if (claimedBy && !isRejoin) {
      throw new Error(`"${localProfile.name}" is already playing in that room from another device. Use a different name.`);
    }

    // Late joins would leave the new player out of turnCounts and shift the
    // assignment rotation mid-round, so only let existing players back in.
    const openSnap = await bestEffort(get(ref(db, `rooms/${code}/open`)));
    if (openSnap?.val() === false && !isRejoin) {
      throw new Error(`Room "${code}" has already started its game.`);
    }

    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    if (!isRejoin) await update(ref(db), { [`rooms/${code}/claims/${playerId}`]: myUid });

    // Transactional so two people joining at the same moment can't clobber each
    // other's append. Rejoining refreshes the stored profile, picking up any
    // characters imported since.
    await runTransaction(ref(db, `rooms/${code}/state/gameSession/players`), (current) => {
      const players = current || [];
      const idx = players.findIndex((p) => p.id === playerId);
      if (idx === -1) return [...players, localProfile];
      const next = [...players];
      next[idx] = localProfile;
      return next;
    });

    rememberRoom(code, playerId);
    setRoomCode(code);
    setMyPlayerId(playerId);
  }, [uid, rememberRoom, bestEffort]);

  const leaveRoom = useCallback(() => exitRoom(), [exitRoom]);

  // Republishes this device's profile into the room — used when a player
  // imports their AniList from the lobby after already joining. Transactional
  // so it can't clobber someone else joining at the same moment.
  const updateMyProfile = useCallback((profile) => {
    const db = getFirebaseDb();
    return guard(runTransaction(ref(db, `rooms/${roomCode}/state/gameSession/players`), (current) => {
      const players = current || [];
      const idx = players.findIndex((p) => p.id === profile.id);
      if (idx === -1) return players;
      const next = [...players];
      next[idx] = profile;
      return next;
    }));
  }, [roomCode, guard]);

  const dismissError = useCallback(() => setError(''), []);

  const patchState = useCallback((patch) => {
    if (!roomCode) return Promise.resolve();
    const db = getFirebaseDb();
    const updates = {};
    for (const [key, value] of Object.entries(patch)) {
      updates[`rooms/${roomCode}/state/${key}`] = value;
    }
    return guard(update(ref(db), updates));
  }, [roomCode, guard]);

  const setView = useCallback((view) => patchState({ view }), [patchState]);

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
  }, [patchState, roomCode, bestEffort]);

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
    const { patch, next } = rules.revealDone(state);
    return patchState({ ...patch, view: next });
  }, [state, patchState]);

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

  const handleTurnComplete = useCallback((logEntry) => {
    const { patch } = rules.turnComplete(state, logEntry);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor]);

  const handleCorrectGuess = useCallback((logEntry) => {
    const { patch } = rules.correctGuess(state, logEntry);
    // The celebration screen says everything — no banner needed after it.
    return patchState({ ...patch, lastOutcome: null, view: 'correctGuess' });
  }, [state, patchState]);

  const handleWrongGuess = useCallback((logEntry) => {
    const { patch } = rules.wrongGuess(state, logEntry);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor]);

  const finishRound = useCallback((locked) => {
    return patchState({ totalScores: rules.applyRoundScores(state.totalScores, locked), view: 'roundEnd' });
  }, [state, patchState]);

  const handlePeek = useCallback(() => {
    const player = state.gameSession.players[state.currentPlayerIndex];
    return patchState({ peekedPlayers: [...state.peekedPlayers, player.id] });
  }, [state, patchState]);

  const handleNewRound = useCallback(() => {
    const { patch, next } = rules.newRound(state);
    return patchState({ ...patch, lastOutcome: null, view: next });
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
    uid, roomCode, myPlayerId, error, syncError, dismissError, dismissSyncError,
    createRoom, joinRoom, leaveRoom, updateMyProfile, setView,
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
    lastOutcome: state?.lastOutcome ?? null,
    currentProposal,
    currentGuesser, assignmentPlayer, hasPeeked, lastLocked,
    isMyAssignmentTurn, isMyTurn,
    handleStartGame, proposeCharacter, lockInAssignment, setMyApproval, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    submitPendingAction, resolvePendingAction, clearPendingAction,
    readAssignment,
  };
}
