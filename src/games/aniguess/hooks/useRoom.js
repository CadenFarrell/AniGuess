import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ref, onValue, update, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb, ensureSignedIn } from '../../../shared/services/firebase';
import { storage } from '../../../shared/services/storage';
import { usePresence } from '../../../shared/hooks/usePresence';
import { GRACE_MS, rosterSnapshot, nextHostId } from '../../../shared/utils/presence';
import * as rules from '../rules';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const EMPTY_PLAYERS = []; // stable identity so the roster memo doesn't churn
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
          // Rooms created before the host role existed have no hostId node at
          // all. Make the absence explicit rather than undefined, so the
          // fallback below is the single place that decides what "no crown"
          // means — and so the migration transaction has one value to CAS on.
          hostId: val.hostId ?? null,
          lockedPositions: val.lockedPositions ?? [],
          peekedPlayers: val.peekedPlayers ?? [],
          questionLogs: val.questionLogs ?? {},
          turnCounts: val.turnCounts ?? {},
          totalScores: val.totalScores ?? {},
          turnState: val.turnState ?? { pendingAction: null },
          lastOutcome: val.lastOutcome ?? null,
          // Same quirk: a room where nobody has written presence yet reads back
          // with no node at all.
          presence: val.presence ?? {},
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

  // --- Who is still here -----------------------------------------------------

  // Publishes this device's presence and, crucially, arranges for Firebase to
  // mark it offline server-side when the tab closes or the network drops. Every
  // turn in this game belongs to exactly one device, so a player who vanishes
  // stops the room dead unless the rotation can see they've gone.
  const markLeft = usePresence(
    roomCode && myPlayerId ? `rooms/${roomCode}/state/presence/${myPlayerId}` : null
  );

  // Presence timestamps are stamped with the server's clock, so the grace
  // window has to be measured against it rather than against this device's.
  const [serverOffset, setServerOffset] = useState(0);
  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return () => unsub();
  }, []);

  const presence = state?.presence ?? null;
  const players = state?.gameSession?.players ?? EMPTY_PLAYERS;

  // --- Who is in charge ------------------------------------------------------
  //
  // The host owns the settings, the Start button, and the round-end decision.
  // Declared up here rather than down with currentGuesser/isMyTurn because the
  // handlers below guard on it, and a binding declared after them would only
  // ever be read through a stale closure.
  //
  // Rooms created before the host role existed carry no hostId, and without a
  // fallback their lobby would be unstartable by anyone, forever. Fall back to
  // players[0] — the creator, since joinRoom only ever appends. Deliberately
  // *not* derived from the roster: presence status is time-based, so two
  // devices a few hundred ms apart could disagree about who the heir is and
  // both render a Start button. players[0] is a pure function of shared state,
  // so it cannot diverge. The reconciliation effect below backfills a real
  // hostId, which is what makes the crown sticky once it has moved.
  const hostId = state?.hostId ?? players[0]?.id ?? null;
  const isHost = myPlayerId != null && hostId === myPlayerId;
  // Both the lobby and the round-end screen name the host, so resolve it once
  // here instead of repeating the lookup in each component.
  const hostName = players.find((p) => p.id === hostId)?.name ?? '';

  const [now, setNow] = useState(() => Date.now());
  const roster = useMemo(
    () => rosterSnapshot(players, presence ?? {}, now + serverOffset),
    [players, presence, now, serverOffset]
  );
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);

  // A grace window expires without any database write, so it needs a clock —
  // but only while someone is mid-drop, so an idle room isn't re-rendering once
  // a second for the whole game. The stored `now` may be stale when the timer
  // starts, which only ever makes a player look *less* gone than they are; the
  // first tick corrects it, and graceRemainingMs clamps the countdown meanwhile.
  const someoneDropping = roster.dropping.length > 0;
  useEffect(() => {
    if (!someoneDropping) return undefined;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    // Hidden tabs have their timers throttled hard (Chrome drops to roughly one
    // wake-up a minute after a few minutes backgrounded), so someone coming back
    // from another app would otherwise stare at a frozen countdown until the
    // next throttled tick. Re-read the clock the instant they return.
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [someoneDropping]);

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
        // The creator is the host: the only player who picks the settings,
        // starts the game, and decides at round end whether to keep playing.
        // Stored in shared state rather than derived per-device so everyone
        // defers to the same person — and stored as the *profile* id, because
        // that is what presence, claims and the turn rotation are all keyed by.
        // The Firebase uid never appears inside state/.
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

  // Tell the room on the way out — but never let a slow network trap someone in
  // a room they've asked to leave, so the local exit doesn't wait on the write.
  const leaveRoom = useCallback(() => {
    const written = markLeft();
    exitRoom();
    return written;
  }, [markLeft, exitRoom]);

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

  // The turn rotation skips anyone who has left — nobody can act on their
  // behalf, so landing on them would stall the room.
  const handleTurnComplete = useCallback((logEntry) => {
    const { patch } = rules.turnComplete(state, logEntry, rosterRef.current.departedIds);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor]);

  const handleCorrectGuess = useCallback((logEntry) => {
    const { patch } = rules.correctGuess(state, logEntry, rosterRef.current.departedIds);
    // The celebration screen says everything — no banner needed after it.
    return patchState({ ...patch, lastOutcome: null, view: 'correctGuess' });
  }, [state, patchState]);

  const handleWrongGuess = useCallback((logEntry) => {
    const { patch } = rules.wrongGuess(state, logEntry, rosterRef.current.departedIds);
    return patchState({ ...patch, lastOutcome: outcomeFor(logEntry) });
  }, [state, patchState, outcomeFor]);

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
  }, [state, patchState, isHost]);

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

  // --- Departure reconciliation ----------------------------------------------
  //
  // Effects that notice a player is gone and unstick whatever they were
  // blocking. Any device may run them: the state each one writes is derived
  // from shared state plus the shared roster, so two devices racing compute the
  // identical patch. The one-shot keys stop a single device retrying every
  // render, and re-arm when the roster or the phase moves on.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const reconciledRef = useRef({});
  const once = useCallback((key, run) => {
    if (reconciledRef.current[key]) return;
    reconciledRef.current[key] = true;
    // A dropped connection is exactly when these run, so a failed write has to
    // re-arm rather than latch. Returning false asks for the same.
    Promise.resolve()
      .then(run)
      .then((ok) => { if (ok === false) delete reconciledRef.current[key]; })
      .catch(() => { delete reconciledRef.current[key]; });
  }, []);

  // Every guard below is scoped to one phase, so a phase change re-arms them
  // all. Without this a one-shot that has already fired stays latched for the
  // life of the room — and the next time the room genuinely needed it, nothing
  // would happen. The host-migration key is the one exception: it encodes the
  // outgoing host instead, because a lobby can need to migrate twice without
  // the view ever changing.
  useEffect(() => { reconciledRef.current = {}; }, [roomCode, state?.view]);

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
    const { active, activeIds, departedIds, statuses } = roster;
    const view = state.view;

    // The crown has to move before anything else: the host is the only one who
    // can start the game or move past a round end, so a room whose host has
    // gone is wedged until it does. Deliberately ABOVE the phase filter below —
    // the 'setup' lobby needs this most of all, being the one phase a room can
    // sit in indefinitely.
    //
    // Compares the *stored* hostId, never the derived one: in a legacy room the
    // derived value is players[0], and a transaction testing against that would
    // abort forever against the null actually in the tree.
    const storedHostId = state.hostId ?? null;
    const needsHost = storedHostId === null
      // No crown was ever written (the room predates the host role). Claim one,
      // or its lobby stays unstartable for everyone.
      ? players.length > 0
      // Only migrate a host who is genuinely in the roster and genuinely gone.
      // activeIds still counts a player mid-drop, so this waits out the grace
      // window rather than moving the crown over a wifi blip.
      : players.some((p) => p.id === storedHostId) && !activeIds.includes(storedHostId);

    if (needsHost) {
      const heir = nextHostId(players, statuses);
      if (heir && heir !== storedHostId) {
        // Keyed on the outgoing host so a second departure re-arms it — the
        // one-shot reset below is keyed on `view`, which never changes while a
        // room sits in the lobby. Every device races here; the compare-and-set
        // picks exactly one winner, so a slower device can't clobber a crown
        // that has already legitimately moved on.
        once(`host:${storedHostId ?? 'unset'}`, () => {
          const db = getFirebaseDb();
          return runTransaction(ref(db, `rooms/${roomCode}/state/hostId`), (cur) =>
            ((cur ?? null) === storedHostId ? heir : undefined)
          ).catch(() => {});
        });
      }
    }

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
    roomCode, state, myPlayerId, players, roster,
    once, patchState, clearPendingAction, endSession,
  ]);

  return {
    uid, roomCode, myPlayerId, error, syncError, dismissError, dismissSyncError,
    createRoom, joinRoom, leaveRoom, updateMyProfile, setView,
    view: state?.view,
    hostId, isHost, hostName,
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
    activePlayers: roster.active,
    activeIds: roster.activeIds,
    departedIds: roster.departedIds,
    playerStatuses: roster.statuses,
    dropping: roster.dropping,
    graceMs: GRACE_MS,
    handleStartGame, proposeCharacter, lockInAssignment, setMyApproval, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    submitPendingAction, resolvePendingAction, clearPendingAction,
    readAssignment,
  };
}
