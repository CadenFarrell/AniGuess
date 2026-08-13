import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    // A runoff is written with an empty `votes`, which RTDB does not store — so
    // it reads back as a runoff with no votes key at all, and rules.castVote
    // would spread `undefined`. `candidates` goes through toArray because a
    // two-element array is exactly the shape RTDB may hand back index-keyed.
    runoff: game.runoff
      ? { candidates: toArray(game.runoff.candidates), votes: game.runoff.votes ?? {} }
      : null,
    reveal: game.reveal ?? {},
    steal: game.steal ?? null,
    deal: game.deal ?? 1,
    // A round dealt before the check phase existed has no `check` node at all,
    // which reads as null and sends the room straight to the clues — the whole
    // backward-compatibility story, with no flag.
    //
    // The node survives RTDB *only* because `asked` is always written as a
    // literal boolean. `responded` is {} on every reset and RTDB does not store
    // empty objects, so if `asked` ever became nullable the whole node would
    // vanish on a reset — and needsCheck would then switch the phase off with
    // the room already sitting in the 'check' view, waiting for a gate that no
    // longer exists.
    check: game.check
      ? { responded: game.check.responded ?? {}, asked: Boolean(game.check.asked) }
      : null,
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

  // A card from a previous round — or a previous DEAL of this round — is still
  // sitting there; the stamp is what makes it invisible rather than wrong. This
  // is also what makes a refresh mid-round work: the card is re-read from the
  // room, not from local state.
  //
  // Both halves are needed. `forRound` alone would render last deal's character
  // during the window between the check reset landing and the new secrets/
  // value arriving, which is a window this device cannot avoid being in — the
  // two writes are separate and it sees them in either order. With both, an
  // out-of-date card falls back to "Waiting for the deal…", which is safe in
  // every interleaving. `?? 1` because a card written before this shipped
  // carries no forDeal and is deal one by definition.
  const dealNo = game?.deal ?? 1;
  const card = dealt && dealt.forRound === roundNumber && (dealt.forDeal ?? 1) === dealNo
    ? dealt
    : null;

  // What this round has already put in somebody's hands, so a re-deal does not
  // hand back a card the table just rejected. Host device only, never written to
  // state/, never rendered, and cleared the moment the check phase ends (see the
  // reconciliation effect) so the window is the pre-clue phase rather than the
  // whole round.
  //
  // This is a real, bounded relaxation of the property startGame documents: the
  // folded name IS the character's identity end to end, so holding it here means
  // the host's device holds the round's answer for longer than one function
  // call, reachable by walking refs in React DevTools rather than only by
  // catching a breakpoint at the right instant. Hashing would be theatre — the
  // host has the pool and could brute-force it in milliseconds. It is taken
  // because the pools under "shared characters only" are small (see minPool),
  // which makes a repeat likely in exactly the case the re-deal exists for.
  //
  // Host migration loses it completely, not partially: an incoming host's ref is
  // empty, so a re-deal it performs can return the card everyone just saw. That
  // is the correct trade — the alternative, publishing the list to state/, is
  // the one thing that cannot happen.
  const dealtRef = useRef([]);

  // Who the fake is, so a re-deal keeps them in the role — see rules.dealRoles'
  // pinFake for why that matters. Same bounds as dealtRef in every respect: host
  // device only, never React state, never state/, cleared when the check phase
  // ends, lost by an incoming host on migration.
  //
  // It is nonetheless a BIGGER relaxation than dealtRef, and pretending otherwise
  // would be the dishonest way to write this comment. dealtRef holds the secret
  // character, which in blind mode is already printed on the host's own card;
  // this holds a fact no player is ever meant to learn. There is no serverless
  // way around it. secrets/{playerId} is read-gated to its owner, so the host
  // cannot recover last deal's fake from the room; deriving the fake from a
  // public seed or parking it in state/ publishes it to everybody; having each
  // device preserve its own role bit still leaves the host deciding who gets a
  // null character; and choosing the fake only when the check ends means the fake
  // spent the check holding the secret. Moving the deal into a Cloud Function is
  // the same real fix startGame names, and it fixes this too.
  //
  // Null whenever the card check is off, so a table that turned it off pays
  // nothing for a feature it is not using.
  const fakeRef = useRef(null);

  // Every secret this round has been dealt, in order and in display casing:
  // [A] after deal one, [A, B] after deal two. Deal N publishes the first N-1 of
  // them on every card, so the fake shares the crew's knowledge of what was
  // thrown away — see the `discarded` note in rules.dealRoles.
  //
  // Unlike the two refs above this is NOT a further widening. dealtRef already
  // holds the same characters as folded ids, and a folded name is the name; this
  // is the identical secret in readable casing, kept separately only because
  // dealtRef also carries decoys and feeds an id comparison. Same lifetime, same
  // clear, same loss on host migration.
  const secretNamesRef = useRef([]);

  // --- writes ----------------------------------------------------------------

  // Every mutation of the round funnels through one transaction on state/game
  // so two devices acting at the same instant can't lose each other's write.
  //
  // RETURNS FALSE ON A FAILED WRITE, and that is load-bearing rather than
  // tidiness: half the calls below run inside useRoomCore's `once`, which
  // re-arms only on a thrown error or an explicit false. Swallowing the failure
  // into setSyncError and returning undefined left the one-shot latched, so a
  // single dropped packet meant the write never happened and nothing would ever
  // retry it. The reveal was the worst case — `publish` is per-device, and
  // `reconciledRef` clears on a view CHANGE, so a device that failed to publish
  // its card sat on "Turning the cards over…" for the rest of the round with no
  // other player able to rescue it.
  //
  // A transaction that ABORTS still resolves (committed: false), which is
  // correct to latch: the rule was a no-op, or another device got there first.
  // Only a genuine write failure re-arms.
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
      return false;
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
    // The secret character is NEVER destructured here. This — the host's device
    // — is the one place in the system where the deal exists in the clear, and
    // binding it to anything that outlives this call would put the answer on a
    // player's screen. A serverless party game cannot do better: some device has
    // to compute the deal, and there is no trusted third party to be it. Moving
    // the deal into a Cloud Function is the real fix.
    //
    // `dealt` and `fakeId` ARE taken, and both are deliberate, bounded widenings
    // of the above rather than oversights — see dealtRef and fakeRef, which state
    // what each costs. Together the ceiling is "the host's device holds the
    // round's answer for the length of the check phase" rather than "for the
    // length of one function call". What they buy is a re-deal that neither hands
    // back the card the table just rejected nor lets the fake veto their way out
    // of the role.
    //
    // Both are gated on `allowRedeal`, not merely convenient to gate: with no
    // check phase there is nothing to re-deal, so a table that turned it off
    // keeps the one-function-call ceiling exactly as it was.
    const { secrets, dealt, fakeId, secretName } = rules.dealRoles(ids, pool, {
      mode: settings.mode, fame: settings.fame, round: nextRound, deal: 1,
    });
    dealtRef.current = settings.allowRedeal ? dealt : [];
    fakeRef.current = settings.allowRedeal ? fakeId : null;
    // Seeded with deal one's secret and never published on deal one — there is
    // nothing discarded yet. It becomes the discard the moment a re-deal lands.
    secretNamesRef.current = settings.allowRedeal && secretName ? [secretName] : [];

    const db = getFirebaseDb();
    // One batch, so a half-dealt round cannot exist. These paths depend only on
    // membership, which was written at join, so the memberUids-first ordering
    // that createRoom/joinRoom need does not apply here.
    const updates = {};
    for (const [id, entry] of Object.entries(secrets)) {
      updates[`rooms/${roomCode}/secrets/${id}`] = entry;
    }
    // Not guard(), which reports a failure and swallows it. A swallowed failure
    // here would move the room to `check` with no cards stored, leaving every
    // device on "Waiting for the deal…" with no write left that could fix it —
    // the same wedge applyGame's `false` exists to prevent, one node over.
    // useRoomCore exposes setSyncError for exactly this: report AND return.
    // Bailing leaves the room in the lobby, where Start is still pressable.
    const stored = await update(ref(db), updates).then(() => true).catch((e) => {
      setSyncError(e?.message || 'Could not deal the round — check your connection.');
      return false;
    });
    if (!stored) return;

    await bestEffort(set(ref(db, `rooms/${roomCode}/open`), false));
    await patchState({
      settings,
      roundNumber: nextRound,
      game: rules.startRound(ids, {
        mode: settings.mode,
        laps: settings.laps,
        wordLimit: 1,
        round: nextRound,
        allowRedeal: settings.allowRedeal,
      }),
      view: settings.allowRedeal ? 'check' : 'clues',
    });
  }, [isHost, roomCode, roundNumber, patchState, bestEffort, rosterRef, setSyncError]);

  // My answer to the card check. `asked` never becomes a per-player value —
  // rules.respondToCheck folds it into one shared latch. See the note there.
  const respondToCheck = useCallback((asked) => (
    applyGame((g) => rules.respondToCheck(g, myPlayerId, { asked }))
  ), [applyGame, myPlayerId]);

  /**
   * Deals the round again, in place. Host only, unlike the reconciliation
   * transitions either side of it: this writes the whole secrets/ batch, and two
   * devices writing different batches would be two different rounds sharing one
   * deal number. Returns false on a failed write so useRoomCore's `once` re-arms
   * rather than leaving the room stuck on a phase nothing can clear.
   */
  const redeal = useCallback(async (snapshot) => {
    if (!isHost || !snapshot) return false;
    const db = getFirebaseDb();
    const nextDeal = (snapshot.deal ?? 1) + 1;
    // The round's OWN roster, not the currently active one. startGame deals from
    // whoever is present, which is right at deal time; reusing that here is not,
    // because under "shared characters only" a player with a narrow list leaving
    // makes the pool GROW — so the re-deal would draw from a different game than
    // the one in progress.
    const ids = snapshot.order ?? [];
    const dealtIn = players.filter((p) => ids.includes(p.id));
    const pool = eligibleCharacters(dealtIn, { sharedOnly: state?.settings?.sharedOnly });
    if (!ids.length || pool.length < rules.minPool(snapshot.mode)) {
      // Nothing left to deal — start the clues rather than leave the room on a
      // phase that no further response can move.
      return runTransaction(ref(db, `rooms/${roomCode}/state/view`), (cur) =>
        (cur === 'clues' ? undefined : 'clues')
      ).then(() => true).catch(() => false);
    }

    const { secrets, dealt, fakeId, secretName } = rules.dealRoles(ids, pool, {
      mode: snapshot.mode,
      fame: state?.settings?.fame,
      round: roundNumber,
      deal: nextDeal,
      exclude: dealtRef.current,
      pinFake: fakeRef.current,
      // Everything dealt SO FAR — this deal's own secret is appended below, not
      // here, or the new cards would name the character they are carrying.
      discarded: secretNamesRef.current,
    });

    // Everyone in `order`, not just the active — a player who reconnects after a
    // re-deal they missed would otherwise hold a card stamped with a dead deal
    // number, which the stamp correctly hides, leaving them on "Waiting for the
    // deal…" permanently with no write that will ever fix it.
    const updates = {};
    for (const [id, entry] of Object.entries(secrets)) {
      updates[`rooms/${roomCode}/secrets/${id}`] = entry;
    }
    // Cards first and atomically, mirroring startGame, then the claim. Between
    // the two every device's stamp check rejects the new cards and shows the
    // waiting state; if two hosts somehow race, both write complete consistent
    // batches and exactly one wins applyRedeal's re-check, leaving the loser's
    // cards stamped with a deal number that never becomes current.
    // Not guard(), for the reason startGame gives — and here it matters twice
    // over, because this function's return value IS the one-shot's re-arm
    // signal. Reporting the failure and then returning true would tell the
    // caller the re-deal landed.
    const stored = await update(ref(db), updates).then(() => true).catch((e) => {
      setSyncError(e?.message || 'Could not deal the round — check your connection.');
      return false;
    });
    // The three refs advance only once the cards are actually stored. Advancing
    // them on a failed write would exclude characters nobody was dealt, pin the
    // fake to a deal that never happened, and publish a `discarded` name the
    // table never saw — which is the one thing that would hand the blind fake a
    // discard list the crew cannot corroborate.
    if (!stored) return false;
    dealtRef.current = [...dealtRef.current, ...dealt];
    // Assigned rather than left alone, for the host-migration case: an incoming
    // host's ref is null, so THIS deal re-rolled the fake (the degradation
    // dealtRef already documents). Recording what it drew pins every deal after
    // it, instead of re-rolling the role on each one for the rest of the phase.
    fakeRef.current = fakeId;
    if (secretName) secretNamesRef.current = [...secretNamesRef.current, secretName];
    // applyGame reports its own failure as false, so this is the claim write's
    // verdict rather than an assumption that it landed.
    return (await applyGame((g) => rules.applyRedeal(g, nextDeal))) !== false;
  }, [isHost, roomCode, players, state, roundNumber, applyGame, setSyncError]);

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

    // Bound all three refs to the phase that needs them, so the host device is
    // not sitting on the answer for the length of the round. See dealtRef,
    // fakeRef and secretNamesRef. Cleared together because they expire for the
    // same reason — once the clues start there is no further deal to exclude
    // from, pin, or publish a discard for.
    if (view !== 'check'
      && (dealtRef.current.length || fakeRef.current || secretNamesRef.current.length)) {
      dealtRef.current = [];
      fakeRef.current = null;
      secretNamesRef.current = [];
    }

    if (view === 'check') {
      // A round sitting in this view with no check node has no gate that can
      // ever close — everyoneChecked would read an absent `responded` as "not
      // everyone" forever. startRound writes the view and the node together so
      // the two cannot disagree today, but RTDB dropping an empty object is
      // exactly how that stops being true (see normalizeGame), and the failure
      // is a wedged room rather than a wrong screen.
      if (!rules.needsCheck(game)) { setViewOnce(`toclues:${roundNumber}`, 'clues'); return; }
      const checkState = rules.checkOutcome(game, activeIds);
      if (!checkState.done) return;
      if (checkState.next === 'redeal') {
        // BOTH keys below embed game.deal, and that is the one thing here most
        // likely to be copied wrong. useRoomCore clears its one-shots on a view
        // CHANGE, and this view does not change between re-deals — so a key
        // shaped like the runoff's ('runoff', deliberately latched for the life
        // of one view, which is what caps it at one) would fire once here and
        // then leave the room wedged with everyone re-checked and nothing
        // happening. The host-migration key is the existing precedent for a
        // one-shot that must re-arm without the view moving.
        if (isHost) once(`redeal:${roundNumber}:${game.deal}`, () => redeal(game));
        return;
      }
      setViewOnce(`toclues:${roundNumber}:${game.deal}`, 'clues');
      return;
    }

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
      const { caught, needsRunoff } = rules.voteOutcome(game);
      if (needsRunoff) {
        // Any device may open it. A tie is already public — every member reads
        // state/game/votes — so acting here leaks nothing the reveal protects,
        // and the transaction aborts if another device got there first.
        //
        // The key does not re-arm inside this view, which is the point: the
        // view stays 'vote' across both ballots, so one runoff per round is
        // exactly what a latched one-shot gives. (useRoomCore clears these on
        // every view change, so the next round starts armed again.)
        once('runoff', () => applyGame(rules.openRunoff));
        return;
      }
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
      const { caught } = rules.voteOutcome(game);
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
  }, [roomCode, state, game, myPlayerId, roster, once, applyGame, card, mode, roundNumber,
    finishRound, isHost, redeal]);

  const speakerId = game ? rules.currentSpeakerId(game) : null;
  // Both are null-safe on a room with no round yet, so the lobby needs no guard.
  const ballot = rules.currentBallot(game);
  const outcome = rules.voteOutcome(game);

  // The check phase collapsed into one string, and `asked` deliberately NOT
  // returned on its own. A screen able to render "someone asked" before every
  // response is in would let anyone at the table pair the flip with whoever
  // responded just before it; folding it into a phase that only exists once the
  // gate has closed makes that unrenderable rather than merely discouraged.
  const check = game && rules.needsCheck(game)
    ? rules.checkOutcome(game, core.activeIds)
    : null;
  const checkPhase = !check
    ? null
    : (!check.done ? 'responding' : (check.next === 'redeal' ? 'redealing' : 'starting'));

  return {
    uid: core.uid, roomCode, myPlayerId,
    error: core.error, syncError: core.syncError,
    dismissError: core.dismissError, dismissSyncError: core.dismissSyncError,
    createRoom: core.createRoom, joinRoom: core.joinRoom, leaveRoom: core.leaveRoom,
    updateMyProfile: core.updateMyProfile, setView: core.setView, returnToLobby,
    view: state?.view,
    hostId: core.hostId, isHost, hostName: core.hostName,
    players,
    // The roster in the round's speaking order, each row carrying a fixed seat.
    // Every in-round screen renders this rather than `players`, which is what
    // stops a name sitting at a different position on each screen. Falls back to
    // the plain roster before the deal, where there is no order to seat by.
    seatedPlayers: game ? rules.seating(game, players) : players,
    settings: state?.settings ?? null,
    totalScores: state?.totalScores ?? {},
    game,
    mode,
    card,
    clues: game?.clues ?? [],
    votes: game?.votes ?? {},
    // All three follow whichever ballot is open, so the screen shows your runoff
    // vote rather than the opening one you can no longer change.
    myVote: ballot.votes[myPlayerId] ?? null,
    votedIds: Object.keys(ballot.votes),
    isRunoff: ballot.isRunoff,
    runoffCandidates: ballot.isRunoff ? ballot.candidates : [],
    // Who the vote landed on, across both ballots. Public — every device can
    // tally state/game/votes — unlike `fakeId`, which needs the reveal.
    caught: outcome.caught,
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
    checkPhase,
    dealNumber: dealNo,
    myCheckResponse: Boolean(game?.check?.responded?.[myPlayerId]),
    // Who the check is still waiting on. Names, like pendingNames above — this
    // says who has not answered YET, which is public by construction, and never
    // how anyone answered.
    checkPendingNames: game
      ? rules.pendingCheckers(game, core.activeIds).map(
        (id) => players.find((p) => p.id === id)?.name ?? id
      )
      : [],
    activePlayers: core.activePlayers,
    activeIds: core.activeIds,
    departedIds: core.departedIds,
    playerStatuses: core.playerStatuses,
    dropping: core.dropping,
    graceMs: core.graceMs,
    startGame, submitClue, castVote, submitSteal, respondToCheck, guard,
  };
}
