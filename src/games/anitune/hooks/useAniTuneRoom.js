import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ref, onValue, update, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb, ensureSignedIn } from '../../../shared/services/firebase';
import { storage } from '../../../shared/services/storage';
import { usePresence } from '../../../shared/hooks/usePresence';
import { GRACE_MS, rosterSnapshot, nextHostId } from '../../../shared/utils/presence';
import { prepareQuestions } from '../services/buildQuestions';
import * as rules from '../rules';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
const EMPTY_PLAYERS = []; // stable identity so the roster memo doesn't churn
// Which room this device is in, so a refresh drops the player straight back into
// the game instead of the join screen. Firebase persists the anonymous uid, so
// the membership rules still pass. Separate key from AniGuess's so the two games'
// saved rooms don't clobber each other.
const ROOM_KEY = 'anitune_online_room';
// Lead time between "everyone's ready" and the synchronized clip start, giving
// every device a moment to schedule playback off the shared timestamp.
const COUNTDOWN_MS = 3000;

function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// Realtime Database drops empty objects/arrays on read-back, and transaction
// callbacks see the raw stored value — so normalize the round-state object at
// every point it enters the hook (subscription AND transactions) before handing
// it to the pure rules, which call .includes/.every on these unguarded.
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

// The Firebase-backed twin of useAniTuneRound: same idea (the pure rules.js
// functions decide what happens, this only decides where the state lives), but
// persisted to Realtime Database so every device shares one round. Modelled on
// src/games/aniguess/hooks/useRoom.js — the room-lifecycle machinery (codes,
// memberUids/claims/open, createRoom/joinRoom, the onValue subscription, guard/
// bestEffort/rememberRoom, saved-room rejoin) is the same; the game-specific
// parts are the buzz race (a transaction, so first-to-buzz wins fairly), the
// concurrent simultaneous submit, and the synchronized clip start.
export function useAniTuneRoom() {
  const [uid, setUid] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [state, setState] = useState(null); // normalized /rooms/{code}/state subtree
  const [serverOffset, setServerOffset] = useState(0); // Firebase server clock skew, ms
  const [isPreparing, setIsPreparing] = useState(false); // this device is building the round
  const [prepProgress, setPrepProgress] = useState(null);
  const [error, setError] = useState(''); // fatal: can't reach Firebase / room gone
  const [syncError, setSyncError] = useState(''); // transient: a write failed

  // Effects that schedule the synced clip read the offset through a ref so they
  // don't need to re-run every time it drifts by a millisecond.
  const serverOffsetRef = useRef(0);
  useEffect(() => { serverOffsetRef.current = serverOffset; }, [serverOffset]);

  const forgetSavedRoom = useCallback(() => storage.removeItem(ROOM_KEY), []);

  const exitRoom = useCallback(() => {
    forgetSavedRoom();
    setRoomCode(null);
    setMyPlayerId(null);
    setState(null);
    setIsPreparing(false);
    setPrepProgress(null);
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

  // Track Firebase's estimate of server time so every device can play the clip
  // at one shared instant rather than "now on my clock".
  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return () => unsub();
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
          exitRoom();
          setError('That room no longer exists. Create or join another one.');
          return;
        }
        setState({
          view: val.view,
          hostId: val.hostId ?? null,
          mode: val.mode ?? null,
          settings: val.settings ?? null,
          round: val.round ?? null,
          // Same empty-collection quirk: a room where nobody has written
          // presence yet reads back with no node at all.
          presence: val.presence ?? {},
          // Same empty-collection quirk one level down: a player who joins with
          // an empty list has no animeList on read-back, and prepareQuestions
          // iterates it unguarded.
          players: (val.players ?? []).map((p) => ({
            ...p,
            animeList: (p.animeList ?? []).map((a) => ({ ...a, characters: a.characters ?? [] })),
          })),
          game: normalizeGame(val.game),
        });
      },
      () => {
        exitRoom();
        setError('Lost access to that room. Rejoin with the room code.');
      }
    );
    return () => unsubscribe();
  }, [roomCode, exitRoom]);

  // --- Who is still here -----------------------------------------------------

  // Publishes this device's presence and, crucially, arranges for Firebase to
  // mark it offline server-side when the tab closes or the network drops.
  const markLeft = usePresence(
    roomCode && myPlayerId ? `rooms/${roomCode}/state/presence/${myPlayerId}` : null
  );

  const presence = state?.presence ?? null;
  const players = state?.players ?? EMPTY_PLAYERS;

  // Server time, so every device agrees on where the grace boundary falls.
  const [now, setNow] = useState(() => Date.now());
  const roster = useMemo(
    () => rosterSnapshot(players, presence ?? {}, now + serverOffset),
    [players, presence, now, serverOffset]
  );
  const rosterRef = useRef(roster);
  useEffect(() => { rosterRef.current = roster; }, [roster]);

  // A grace window is the one thing that expires without any database write, so
  // it needs a clock. Only while someone is actually mid-drop — once they've
  // timed out (or come back) the roster is stable again and an idle room
  // shouldn't re-render every second for the rest of the match. The stored
  // `now` may be stale when the timer starts, which only ever makes a player
  // look *less* gone than they are; the first tick corrects it, and
  // graceRemainingMs clamps the countdown meanwhile.
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

  const guard = useCallback((promise) => {
    return Promise.resolve(promise).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, []);

  const dismissSyncError = useCallback(() => setSyncError(''), []);
  const dismissError = useCallback(() => setError(''), []);

  // The `open` flag / pre-join `claims` read depend on database.rules.json rules;
  // treat a permission failure as "unknown" and fall back to the permissive path
  // rather than blocking play outright.
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

    // memberUids first (awaited) so the claims/state rules, which depend on it
    // already existing, pass — Firebase evaluates multi-path updates against the
    // pre-update tree.
    const playerId = localProfile.id;
    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    await update(ref(db), {
      [`rooms/${code}/claims/${playerId}`]: myUid,
      [`rooms/${code}/state`]: {
        view: 'lobby',
        // The creator is the host: the only player who picks settings and starts
        // the game. Stored in shared state so every device knows who to defer to.
        hostId: localProfile.id,
        mode: null,
        settings: null,
        round: null,
        game: null,
        players: [localProfile],
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

    // Player ids come from the name; check the claim BEFORE writing memberUids
    // (which is write-once) so a name collision can't lock this device out.
    const claimSnap = await bestEffort(get(ref(db, `rooms/${code}/claims/${playerId}`)));
    const claimedBy = claimSnap?.val() ?? null;
    const isRejoin = claimedBy === myUid;
    if (claimedBy && !isRejoin) {
      throw new Error(`"${localProfile.name}" is already playing in that room from another device. Use a different name.`);
    }

    // Late joins would leave the newcomer out of the deal, so only existing
    // players may rejoin once the round has started.
    const openSnap = await bestEffort(get(ref(db, `rooms/${code}/open`)));
    if (openSnap?.val() === false && !isRejoin) {
      throw new Error(`Room "${code}" has already started its game.`);
    }

    await update(ref(db), { [`rooms/${code}/memberUids/${myUid}`]: playerId });
    if (!isRejoin) await update(ref(db), { [`rooms/${code}/claims/${playerId}`]: myUid });

    // Transactional so two people joining at once can't clobber each other's
    // append; rejoining refreshes the stored profile (picks up new imports).
    await runTransaction(ref(db, `rooms/${code}/state/players`), (current) => {
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

  // Republishes this device's profile — used when a player imports their AniList
  // from the lobby after joining.
  const updateMyProfile = useCallback((profile) => {
    const db = getFirebaseDb();
    return guard(runTransaction(ref(db, `rooms/${roomCode}/state/players`), (current) => {
      const players = current || [];
      const idx = players.findIndex((p) => p.id === profile.id);
      if (idx === -1) return players;
      const next = [...players];
      next[idx] = profile;
      return next;
    }));
  }, [roomCode, guard]);

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
  }, [roomCode]);

  // The host prepares the round (the slow networked part) and publishes it so
  // every device deals identical clips. Others just watch the view flip to
  // 'preparing' then 'round'. Guarded so only the host can start, even though the
  // UI already hides the control from everyone else.
  const startGame = useCallback(async (settings) => {
    if (state?.hostId !== myPlayerId) return;
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
  }, [state?.hostId, myPlayerId, roomCode, patchState, bestEffort]);

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
  }, [roomCode, guard]);

  // --- Race ---

  const buzz = useCallback(() => applyGame((game) => rules.buzz(game, myPlayerId)), [applyGame, myPlayerId]);

  const resolveBuzz = useCallback((question, guess) => applyGame((game) => {
    // Only the buzzer resolves, and only while still buzzed — guards a stale tap.
    if (game.phase !== 'buzzed' || game.buzzedBy !== myPlayerId) return { patch: {} };
    // Active roster: a wrong buzz should reveal once everyone *still here* is
    // locked out, not wait on players who have gone.
    return rules.resolveBuzz(game, question, guess, rosterRef.current.active);
  }), [applyGame, myPlayerId]);

  const giveUp = useCallback(() => applyGame((game) => rules.giveUp(game)), [applyGame]);

  // --- Simultaneous ---

  const submitAnswer = useCallback((question, text) => applyGame((game) =>
    rules.submitOnlineAnswer(game, question, myPlayerId, text, rosterRef.current.activeIds)
  ), [applyGame, myPlayerId]);

  const revealNow = useCallback(() => applyGame((game) => rules.revealNow(game)), [applyGame]);

  // --- Advancement ---

  // Idempotent against everyone tapping "Next": the transaction only advances
  // from a 'revealed' phase, and a finished round is parked at phase 'finished'
  // so a second device can't re-advance past the end.
  const advance = useCallback(async () => {
    const db = getFirebaseDb();
    const players = state?.players ?? [];
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
  }, [roomCode, state?.players, state?.round?.length, patchState]);

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
  const hostId = state?.hostId ?? null;
  const isHost = myPlayerId != null && hostId === myPlayerId;
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
  // Nothing above notices a departure on its own; these checks do. Any device
  // may run them — every action is a transaction that aborts if someone else
  // got there first — and the one-shot keys stop a single device retrying on
  // every render. Keys fold in the question index and the active roster, so a
  // rejoin followed by a fresh departure re-arms them.
  const reconciledRef = useRef({});
  const once = useCallback((key, run) => {
    if (reconciledRef.current[key]) return;
    reconciledRef.current[key] = true;
    // A dropped connection is exactly when these run, so a failed write has to
    // re-arm rather than latch — otherwise one unlucky moment leaves the room
    // wedged with no second attempt. Returning false asks for the same.
    Promise.resolve()
      .then(run)
      .then((ok) => { if (ok === false) delete reconciledRef.current[key]; })
      .catch(() => { delete reconciledRef.current[key]; });
  }, []);

  // Every guard below is scoped to one phase, so a phase change re-arms them
  // all. Without this a one-shot that has already fired stays latched for the
  // life of the room — and the next time the room genuinely needed it, nothing
  // would happen.
  useEffect(() => {
    reconciledRef.current = {};
  }, [roomCode, state?.view]);

  useEffect(() => {
    if (!roomCode || !state || !myPlayerId) return;
    const { active, activeIds, statuses } = roster;
    const view = state.view;
    const g = state.game;

    // The host is the only one who can start a game, so the crown has to move
    // before anything else — otherwise the room is unplayable from the lobby on.
    const hostInRoster = players.some((p) => p.id === state.hostId);
    if (state.hostId && hostInRoster && !activeIds.includes(state.hostId)) {
      const heir = nextHostId(players, statuses);
      if (heir) {
        once(`host:${state.hostId}`, () => {
          const db = getFirebaseDb();
          runTransaction(ref(db, `rooms/${roomCode}/state/hostId`), (cur) =>
            (cur === state.hostId ? heir : undefined)
          ).catch(() => {});
        });
      }
    }

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
    roomCode, state, myPlayerId, players, roster, isHost, isPreparing,
    once, applyGame, revealNow, giveUp, patchState, bestEffort, endMatch,
  ]);

  return {
    uid, roomCode, myPlayerId, error, syncError, dismissError, dismissSyncError,
    createRoom, joinRoom, leaveRoom, updateMyProfile, setView, returnToLobby,
    isPreparing, prepProgress, serverOffset,
    view: state?.view,
    hostId, isHost,
    mode: state?.mode ?? null,
    settings: state?.settings ?? null,
    players,
    playerIds,
    // The roster minus anyone who left or timed out. Components should count
    // these, not `players`, for anything the room has to wait on.
    activePlayers: roster.active,
    activeIds: roster.activeIds,
    departedIds: roster.departedIds,
    playerStatuses: roster.statuses,
    dropping: roster.dropping,
    graceMs: GRACE_MS,
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
