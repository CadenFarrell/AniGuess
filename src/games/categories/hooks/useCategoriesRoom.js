import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, onValue, get, set, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useCustomCategories } from './useCustomCategories';
import { dealCategories, getCategory } from '../categories';
import * as rules from '../rules';

const ROOM_KEY = 'anitag_online_room';

// The Firebase-backed twin of useCategoriesRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// WHICH NODE A CLAUSE LIVES IN IS DECIDED BY WHO MUST NOT SEE IT, which is
// CLAUDE.md's stated question, and AniTag now answers it BOTH WAYS — one mode
// per row of that table. It is the worked example, so it is worth being exact:
//
//   dealt   assignments/{playerId}. Read AND write denied to the assignee,
//           allowed to everyone else. A value about you that you alone must not
//           learn — the AniGuess shape.
//   chosen  secrets/{playerId}. Read allowed ONLY to the owner, write allowed
//           to any member. A value only you may learn — the AniFake/AniWave
//           shape, except that here the owner is also the one writing it.
//
// Both rules were already deployed, so neither mode needed a
// database.rules.json change. Reaching for the wrong one is silent: a chosen
// clause written to assignments/ would be readable by every player it is meant
// to be hidden from, and a dealt one written to secrets/ would be readable by
// precisely the one player the mode is built around keeping in the dark.
//
// DEALT: NOBODY DEALS THEIR OWN, and the deal is split across two devices to
// guarantee it. The host writes every slot except its own; the first other
// seated player writes the host's. Both writes are legal under the deployed
// rule and the forbidden one is rejected by Firebase rather than by a
// client-side check, so a bug there is a PERMISSION_DENIED in the console
// instead of a silent leak. That is where this mode escapes AniFake's "whoever
// computes the deal learns it" concession rather than inheriting it.
//
// ONE RESIDUAL LIMIT OF THAT SPLIT, recorded rather than designed around: the
// second dealer cannot read its own category, so when it draws the host's it
// cannot rule out the one clause it holds itself. It excludes every category it
// CAN see, leaving a roughly one-in-a-dozen chance the host and that one player
// end a round holding the same clause. Unfixable without a server — any device
// able to exclude every dealt category would by construction know its own.
//
// CHOSEN: THERE IS NO DEAL AT ALL, which is strictly stronger and much less
// machinery. Every device writes its own clause to its own secrets/ node and
// nothing else, so no device ever holds a value it is not entitled to and there
// is no dealer to be careful about. The round waits in `picking` until every
// ACTIVE player has committed one — the active roster, so a closed tab cannot
// hold the table on the opening screen forever.
//
// A PLAYER'S WRITTEN CATEGORIES NEVER ENTER ROOM STATE, in either mode. Each
// device draws or offers from the built-ins plus ITS OWN local list, and only
// the clause actually in play is published — the same rule AniWave applies to
// written spectra. Putting them in state/settings would have been simpler and
// would have published everything a player has ever written to everybody in the
// room, most of which no round will ever use.
const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  players: [localProfile],
});

function normalizeState(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    players: Array.isArray(raw.players) ? raw.players.filter(Boolean) : [],
    totalScores: raw.totalScores ?? {},
    // The single point round state enters the hook — so nothing downstream, and
    // least of all rules.js, ever sees the shapes RTDB drops.
    game: rules.normalizeGame(raw.game),
  };
}

export function useCategoriesRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players, hostId,
    patchState, once, setSyncError, roster,
  } = core;

  // This device's own written categories — read here rather than passed in,
  // because both dealing effects live in this hook and neither screen that
  // renders them has any reason to hold the list. See the header for why they
  // are never published.
  const { categories: myCustom } = useCustomCategories();

  const game = state?.game ?? null;
  const settings = state?.settings ?? null;
  // Read off the ROUND, not off settings: the round is what rules.js acts on,
  // and a lobby that could still write settings mid-game would otherwise change
  // which mode a turn already in flight is being judged under.
  const chosen = rules.isChosen(game);
  // Memoized because it feeds two effects' dependency arrays: the bare
  // conditional mints a new [] every render when the setting is off, which
  // re-runs both deal effects forever.
  const extraCategories = useMemo(
    () => (settings?.useCustom === false ? [] : myCustom),
    [settings?.useCustom, myCustom],
  );
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const activeIds = roster.activeIds;
  const departedIds = roster.departedIds;

  const seatId = game?.seatId ?? null;
  const iAmSeat = !!seatId && seatId === myPlayerId;

  // WHO OWES AN ANSWER — the one branch, resolved once here and passed
  // everywhere else. See rules.requiredJudges.
  const judgeIds = useMemo(
    () => (game ? rules.requiredJudges(game, playerIds, departedIds) : []),
    [game, playerIds, departedIds],
  );
  const iMustRule = (
    !!myPlayerId
    && judgeIds.includes(myPlayerId)
    && typeof game?.pending?.verdicts?.[myPlayerId] !== 'boolean'
  );

  // --- dealt mode: the hot seat's category -------------------------------------
  //
  // assignments/ is a SIBLING of state/, so useRoomCore's subscription never
  // sees it and this needs its own. Precedent: useRoom.js's assignments listener
  // and useAniFakeRoom's dealt-card listener.
  //
  // Watches the SEAT rather than this device: what a judge needs to rule is the
  // clause of whoever is naming, and what this device is denied is only its own.
  // So the subscription simply never opens on the seat's own device — there is
  // nothing for it to be refused, and no error path to swallow.
  const [seatSpec, setSeatSpec] = useState(null);
  useEffect(() => {
    // No setState in this branch: the previous run's cleanup already nulled it
    // on any dependency change, and it starts null. Setting it here as well is
    // the synchronous-setState-in-an-effect that react-hooks forbids, and it
    // would be a redundant cascading render even where it is legal.
    if (!roomCode || !seatId || seatId === myPlayerId || chosen) return undefined;
    const db = getFirebaseDb();
    const node = ref(db, `rooms/${roomCode}/assignments/${seatId}`);
    const unsub = onValue(node, (snap) => setSeatSpec(snap.val() ?? null), () => setSeatSpec(null));
    return () => { unsub(); setSeatSpec(null); };
  }, [roomCode, seatId, myPlayerId, chosen]);

  // A category from a previous round is still sitting in that node. The stamp is
  // what makes it invisible rather than wrong — assignments are STAMPED, never
  // cleared, because a clear is N writes that can half-fail and leave the
  // previous answer readable. Same trick as AniGuess's assignment stamp and
  // AniFake's forRound/forDeal pair.
  const seatCategory = (
    !chosen && game && seatSpec && seatSpec.forRound === game.round
      && rules.toSpec(seatSpec.category)
      ? getCategory(seatSpec.category)
      : null
  );

  // --- chosen mode: my own category --------------------------------------------
  //
  // The mirror of the block above, and the difference is the whole mode: there
  // this device watches somebody ELSE's node because its own is forbidden; here
  // it watches its own because every other one is. Same stamp rule — written
  // once per round, never cleared, so last round's clause is invisible rather
  // than wrong with no extra write.
  const [mySecret, setMySecret] = useState(null);
  useEffect(() => {
    if (!roomCode || !myPlayerId || !chosen) return undefined;
    const db = getFirebaseDb();
    const node = ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`);
    const unsub = onValue(node, (snap) => setMySecret(snap.val() ?? null), () => setMySecret(null));
    return () => { unsub(); setMySecret(null); };
  }, [roomCode, myPlayerId, chosen]);

  const mySpec = (
    chosen && game && mySecret && mySecret.forRound === game.round
      ? rules.toSpec(mySecret.category)
      : null
  );
  const myCategory = mySpec ? getCategory(mySpec) : null;

  // --- dealing (dealt mode only) -----------------------------------------------

  const seated = useMemo(
    () => (roster.activeIds.length ? roster.activeIds : playerIds),
    [roster.activeIds, playerIds],
  );
  // Deterministic, so every device agrees who the second dealer is without a
  // write. Re-derives if that player leaves, which is what re-arms the one-shot
  // below rather than leaving the host's slot empty forever.
  const secondDealerId = seated.find((id) => id !== hostId) ?? null;

  // The host deals every slot but its own.
  useEffect(() => {
    if (!roomCode || !game || !isHost || state?.view !== 'round' || chosen) return;
    const others = seated.filter((id) => id !== hostId);
    if (!others.length) return;
    // Keyed on the round: useRoomCore clears its one-shots on a VIEW change and
    // the view stays 'round' all game, so without the round in the key this
    // fires once and round two is dealt nothing. The `secret:${round}` note in
    // useWavelengthRoom is the same lesson.
    once(`deal:${game.round}`, async () => {
      const db = getFirebaseDb();
      // Self-healing rather than trusting the latch: if a slot this device is
      // responsible for is already stamped for this round, the deal happened.
      const probe = await get(ref(db, `rooms/${roomCode}/assignments/${others[0]}`));
      if (probe.val()?.forRound === game.round) return;
      const dealt = dealCategories(others, Math.random, {
        pool: settings?.categoryPool,
        extra: extraCategories,
      });
      await Promise.all(others.map((id) => set(
        ref(db, `rooms/${roomCode}/assignments/${id}`),
        { category: dealt[id], forRound: game.round },
      )));
    });
  }, [roomCode, game, chosen, isHost, hostId, seated, settings, extraCategories, state?.view, once]);

  // One other device deals the host's, because the host may not deal its own.
  useEffect(() => {
    if (!roomCode || !game || state?.view !== 'round' || chosen) return;
    if (!hostId || myPlayerId !== secondDealerId) return;
    // Keyed on this dealer as well as the round, so a dealer who leaves before
    // writing hands the job on rather than latching it closed.
    once(`dealhost:${game.round}:${myPlayerId}`, async () => {
      const db = getFirebaseDb();
      const hostSlot = ref(db, `rooms/${roomCode}/assignments/${hostId}`);
      const existing = await get(hostSlot);
      if (existing.val()?.forRound === game.round) return;
      // Everything this device is ALLOWED to see, so the host does not get a
      // clause somebody else already holds. Its own is the one it cannot rule
      // out — see the header for why that is unfixable without a server.
      const visible = await Promise.all(
        seated
          .filter((id) => id !== myPlayerId && id !== hostId)
          .map((id) => get(ref(db, `rooms/${roomCode}/assignments/${id}`))),
      );
      const taken = visible
        .map((snap) => snap.val()?.category)
        .filter((spec) => rules.toSpec(spec));
      const dealt = dealCategories([hostId], Math.random, {
        pool: settings?.categoryPool,
        extra: extraCategories,
        exclude: taken,
      });
      await set(hostSlot, { category: dealt[hostId], forRound: game.round });
    });
  }, [roomCode, game, chosen, hostId, myPlayerId, secondDealerId, seated, settings,
      extraCategories, state?.view, once]);

  // --- round mutations --------------------------------------------------------
  //
  // Every mutation of the round funnels through one transaction on state/game so
  // two devices acting at the same instant can't lose each other's write. The
  // callback re-normalizes, because a transaction callback sees the RAW stored
  // value rather than the subscription's repaired one.
  const applyRound = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = rules.normalizeGame(raw);
      if (!current) return; // abort — no round yet
      const { patch } = fn(current);
      if (!patch || Object.keys(patch).length === 0) return; // abort — rule no-op
      return { ...current, ...patch };
    }).catch((e) => {
      setSyncError(e?.message || 'Could not sync with the room — check your connection.');
    });
  }, [roomCode, setSyncError]);

  const startGame = useCallback(async (nextSettings) => {
    if (!isHost) return;
    // Deal from the players actually here: a departed player should not be
    // handed the opening turn.
    const ids = roster.active.map((p) => p.id);
    await patchState({
      settings: nextSettings,
      totalScores: {},
      bankedRound: null,
      game: rules.startRound(ids.length ? ids : playerIds, {
        round: 0,
        cap: nextSettings.proposalCap,
        mode: nextSettings.categoryMode,
      }),
      view: 'round',
    });
  }, [isHost, patchState, roster, playerIds]);

  /**
   * CHOSEN MODE: this device commits the clause only it will ever read.
   *
   * Two writes and they are deliberately not one: the clause goes to a node
   * outside state/ that nobody else may read, and the FLAG saying a pick
   * happened goes into state/ where the table can see who it is waiting on.
   * Merging them would put the clause in the subtree every member subscribes to.
   *
   * Stamped with the round and never cleared, for the reason every stamp in the
   * arcade exists: a clear is a write that can fail and leave the previous
   * answer readable, while a stale stamp is invisible for free.
   */
  const pickCategory = useCallback(async (spec) => {
    const category = rules.toSpec(spec);
    if (!category || !roomCode || !myPlayerId || !game) return;
    try {
      const db = getFirebaseDb();
      await set(
        ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`),
        { category, forRound: game.round },
      );
    } catch (e) {
      setSyncError(e?.message || 'Could not save your category — check your connection.');
      return;
    }
    await applyRound((g) => rules.recordPick(g, myPlayerId));
  }, [applyRound, game, myPlayerId, roomCode, setSyncError]);

  const propose = useCallback((text) => (
    applyRound((g) => rules.proposeName(g, myPlayerId, text))
  ), [applyRound, myPlayerId]);

  const declare = useCallback((guess, targetId = null) => (
    applyRound((g) => rules.declareCategory(g, myPlayerId, guess, targetId))
  ), [applyRound, myPlayerId]);

  /**
   * This device rules.
   *
   * Recomputes the required list INSIDE the transaction rather than passing the
   * memo in, so the answer this write is checked against is the one the stored
   * round implies at the moment it lands — not the one this device rendered
   * some seconds ago with a different roster.
   *
   * Who may call this at all is requiredJudges' answer and this hook's job to
   * enforce — rules.judge deliberately takes no roster, for the reason stated
   * there. The screen only renders the buttons for a judge who owes an answer,
   * and rules.judge refuses anyone not on the list anyway.
   */
  const rule = useCallback((verdict) => (
    applyRound((g) => rules.judge(
      g, myPlayerId, verdict, rules.requiredJudges(g, playerIds, departedIds),
      // The roster again, for the seat rather than for the verdict: a settled
      // name hands the seat on, and rules.judge has no other way to know who
      // sits next. Resolved inside the transaction with everything else.
      playerIds, departedIds,
    ))
  ), [applyRound, myPlayerId, playerIds, departedIds]);

  const pass = useCallback(() => (
    applyRound((g) => rules.passTurn(g, myPlayerId))
  ), [applyRound, myPlayerId]);

  // The host's version, for a hot seat who has stopped responding without
  // disconnecting. A different rules function rather than pass-with-a-flag —
  // see rules.abandonTurn.
  const abandonTurn = useCallback(() => (
    applyRound((g) => rules.abandonTurn(g))
  ), [applyRound]);

  const nextTurn = useCallback(() => (
    applyRound((g) => rules.nextTurn(g, playerIds, departedIds))
  ), [applyRound, playerIds, departedIds]);

  const nextRound = useCallback(async () => {
    if (!isHost || !game) return;
    const ids = roster.activeIds.length ? roster.activeIds : playerIds;
    await patchState({
      game: rules.startRound(ids, {
        round: game.round + 1,
        // Both from the ROUND rather than from settings, so neither can drift
        // mid-session if the lobby is ever able to write settings again.
        cap: game.cap,
        mode: game.mode,
      }),
    });
  }, [isHost, game, patchState, roster, playerIds]);

  const finish = useCallback(() => (
    isHost ? patchState({ view: 'results' }) : undefined
  ), [isHost, patchState]);

  // Back to the lobby with the settings intact, so a table can retune and go
  // again without re-entering the room code.
  const returnToLobby = useCallback(() => (
    isHost ? patchState({ view: 'lobby', game: null, bankedRound: null }) : undefined
  ), [isHost, patchState]);

  // --- opening the first turn (chosen mode) ------------------------------------
  //
  // The host flips the round out of `picking` once every ACTIVE player has
  // committed a clause. Active rather than everyone, so a closed tab cannot
  // hold the table on the opening screen forever — and the latch is safe
  // against that shrinking, because "everyone here has picked" over a smaller
  // roster is still true.
  useEffect(() => {
    if (!chosen || !isHost || !game || state?.view !== 'round') return;
    if (game.phase !== 'picking') return;
    if (!rules.everyonePicked(game, activeIds)) return;
    once(`begin:${game.round}`, () => applyRound((g) => rules.beginNaming(g, activeIds)));
  }, [chosen, isHost, game, state?.view, activeIds, once, applyRound]);

  // --- settling a pending nobody is left to answer ------------------------------
  //
  // THE ONE THING A DEPARTURE BREAKS THAT NO OTHER MECHANISM REPAIRS. Normally
  // rules.judge settles the moment the last required verdict lands, so this
  // never fires. But the required set SHRINKS when somebody leaves, so a
  // pending that could not settle a minute ago can settle now with no new
  // verdict at all — and nobody is going to submit one, because the device that
  // owed it is gone. See rules.settlePending.
  //
  // Deliberately NOT one-shotted and deliberately not host-only. The
  // transaction is idempotent (settlePending refuses outside `judging`) and
  // self-limiting — once it commits, the phase changes and this stops matching
  // — so the worst case is a few devices firing one aborted write each. A
  // `once` would need a key naming a pending, which has no id, and host-only
  // would break in exactly the case where the host is the one who left.
  useEffect(() => {
    if (!game || state?.view !== 'round' || game.phase !== 'judging') return;
    if (!game.pending) return;
    const required = rules.requiredJudges(game, playerIds, departedIds);
    const settleable = required.every((id) => typeof game.pending.verdicts?.[id] === 'boolean');
    if (!settleable) return;
    applyRound((g) => rules.settlePending(
      g, rules.requiredJudges(g, playerIds, departedIds), playerIds, departedIds,
    ));
  }, [game, state?.view, playerIds, departedIds, applyRound]);

  // --- publishing the answer --------------------------------------------------
  //
  // DEALT: the hot seat's own device is DENIED their category, so at the end of
  // their turn they are the one person who still does not know what it was. Any
  // other device may say, and the first to notice does — which is why this is
  // not gated on being the judge: a judge who leaves between ruling and
  // revealing costs nothing, and two devices racing write the same value once
  // (attachCategory refuses to overwrite).
  useEffect(() => {
    if (chosen || !game || game.phase !== 'turnEnd' || !seatId) return;
    if (iAmSeat || !seatCategory) return;
    if (game.results?.[seatId]?.category) return;
    once(`tell:${game.round}:${seatId}`, () => (
      applyRound((g) => rules.attachCategory(g, seatId, seatSpec?.category))
    ));
  }, [chosen, game, seatId, iAmSeat, seatCategory, seatSpec, once, applyRound]);

  // CHOSEN: the exact mirror. My clause is in a node only I can read, so I am
  // the only device that CAN publish it — AniFake's publishCard shape, where
  // every device publishes its own and nothing else. rules.publishCategory
  // decides when it is safe (I have been claimed, or the round is over), so
  // this effect never has to know about the free-points hole that rule exists
  // to close. Idempotent and self-limiting for the same reason as the settler
  // above: once `reveal` holds my key, the guard returns early.
  useEffect(() => {
    if (!chosen || !game || !myPlayerId || !mySpec || state?.view !== 'round') return;
    if (game.reveal?.[myPlayerId]) return;
    if (!rules.revealAllowed(game, myPlayerId)) return;
    applyRound((g) => rules.publishCategory(g, myPlayerId, mySpec));
  }, [chosen, game, myPlayerId, mySpec, state?.view, applyRound]);

  // --- banking ----------------------------------------------------------------
  //
  // The host folds a finished round into the totals, claimed with a
  // compare-and-set so a re-render — or two devices racing — cannot double-count
  // an applyRoundScores that is deliberately not idempotent.
  useEffect(() => {
    if (!isHost || !roomCode || !game) return;
    if (game.phase !== 'roundEnd') return;
    if (state?.bankedRound === game.round) return;
    once(`bank:${game.round}`, async () => {
      const db = getFirebaseDb();
      const claim = await runTransaction(
        ref(db, `rooms/${roomCode}/state/bankedRound`),
        (cur) => (cur === game.round ? undefined : game.round),
      );
      if (!claim.committed) return;
      await patchState({
        totalScores: rules.applyRoundScores(
          state?.totalScores ?? {},
          rules.finalScores(game, playerIds),
        ),
      });
    });
  }, [isHost, roomCode, game, state, playerIds, patchState, once]);

  // --- departure reconciliation ----------------------------------------------
  //
  // The generic half (host migration, the one-shot itself) is useRoomCore's.
  // What stays here is deciding what an absence BROKE — and for AniTag that is
  // exactly ONE role. A departed JUDGE repairs itself: in dealt mode judgeIdFor
  // derives the role from the roster on every render, and in chosen mode they
  // simply stop being required, which the settler above notices. A departed
  // spectator was never blocking anything. Only the hot seat holds a turn
  // nobody else can finish.
  //
  // Keyed on the seat as well as the round, so handing the turn to a successor
  // who then also leaves re-arms this rather than latching it closed.
  useEffect(() => {
    if (!game || !state || state.view !== 'round') return;
    if (game.phase === 'roundEnd') return;
    if (!game.seatId || !departedIds.includes(game.seatId)) return;
    once(`seat:${game.round}:${game.seatId}`, () => (
      applyRound((g) => rules.skipDepartedSeat(g, playerIds, departedIds))
    ));
  }, [game, state, departedIds, playerIds, once, applyRound]);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const toPlayers = useCallback(
    (ids) => ids.map((id) => byId.get(id)).filter(Boolean),
    [byId],
  );

  return {
    ...core,
    game,
    settings,
    chosen,
    phase: game?.phase ?? 'naming',
    seatId,
    iAmSeat,
    // Everyone who still owes an answer on the pending item, and whether this
    // device is one of them. Replaces the single judgeId/iAmJudge pair, which
    // could not describe a chosen-mode round where the whole table rules.
    judgeIds,
    iMustRule,
    judges: toPlayers(judgeIds),
    pendingJudges: toPlayers(
      judgeIds.filter((id) => typeof game?.pending?.verdicts?.[id] !== 'boolean'),
    ),
    seat: byId.get(seatId) ?? null,
    // This device's own name. The pick screen addresses the player by it, and
    // useRoomCore returns only the id.
    myName: byId.get(myPlayerId)?.name ?? 'You',
    // DEALT: null on the hot seat's own device, always — and by a Firebase rule
    // rather than by this line. Every other device holds it from the deal.
    seatCategory,
    // CHOSEN: null on every device but its owner's, by the mirror rule.
    myCategory,
    iHavePicked: !!game && !!myPlayerId && rules.hasPicked(game, myPlayerId),
    // Who is still being waited on during `picking`, by name, so the screen can
    // say it rather than showing an anonymous spinner.
    pendingPickers: toPlayers(activeIds.filter((id) => !rules.hasPicked(game, id))),
    // Who the seat may still claim. Legitimately empty once every other player
    // has been solved — the screen has to say so.
    declarable: toPlayers(game ? rules.declarableIds(game, playerIds, departedIds) : []),
    // Whether this device has what it needs to play its part of the turn. In
    // dealt mode the seat needs nothing and everyone else is waiting on the
    // deal; in chosen mode there is no deal to wait for, so it is always true
    // and the `picking` phase is the gate instead.
    dealReady: chosen || iAmSeat || !!seatCategory,
    pending: game?.pending ?? null,
    trail: game ? rules.trailFor(game, seatId) : [],
    // EVERY trail, not just the seat's — see the local hook for why. Public in
    // both, which is what makes handing the whole map to a screen safe: the
    // clauses are hidden and the evidence about them never was.
    trails: game?.trails ?? {},
    used: game ? rules.proposalsUsed(game, seatId) : 0,
    left: game ? rules.proposalsLeft(game, seatId) : 0,
    usedFor: (playerId) => (game ? rules.proposalsUsed(game, playerId) : 0),
    leftFor: (playerId) => (game ? rules.proposalsLeft(game, playerId) : 0),
    // The rotation, with departures marked — the one thing local play has no
    // equivalent of, and the reason this passes departedIds and that does not.
    order: (game ? rules.turnOrder(game, playerIds, departedIds) : []).map((row) => ({
      ...row, name: byId.get(row.playerId)?.name ?? 'Someone',
    })),
    lastPlayed: game?.lastPlayed ?? null,
    cap: game?.cap ?? 0,
    roundComplete: game ? rules.roundComplete(game, activeIds) : false,
    explain: game ? rules.explainRound(game, playerIds) : [],
    roundScores: game ? rules.finalScores(game, playerIds) : {},
    totalScores: state?.totalScores ?? {},
    roundNumber: (game?.round ?? 0) + 1,
    totalRounds: settings?.rounds ?? 0,
    isFinalRound: (game?.round ?? 0) + 1 >= (settings?.rounds ?? 0),
    startGame,
    pickCategory,
    propose,
    declare,
    rule,
    pass,
    abandonTurn,
    nextTurn,
    nextRound,
    finish,
    returnToLobby,
  };
}
