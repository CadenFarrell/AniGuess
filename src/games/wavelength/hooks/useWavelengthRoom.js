import { useCallback, useEffect, useMemo, useState } from 'react';
import { ref, onValue, set, update, runTransaction } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/services/firebase';
import { useRoomCore } from '../../../shared/hooks/useRoomCore';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import { getSpectrum, spectrumIdOf } from '../spectra';
import { dealHand, searchableCards } from '../utils/cards';
import * as rules from '../rules';

const ROOM_KEY = 'aniwave_online_room';

// The Firebase-backed twin of useWavelengthRound. Same pure rules; the room
// lifecycle comes from shared/hooks/useRoomCore.js.
//
// NOTHING THE PSYCHIC KNOWS PASSES THROUGH A DEVICE THAT IS NOT THEIRS.
//
// AniFake had to concede that "whoever computes the deal learns it" — its host
// draws every card, so the host's device holds the answer, and CLAUDE.md records
// the bounded refs that concession forced. AniWave does not need that concession
// and must not acquire one. The host starts a round by naming the psychic and
// the mode and nothing else; the PSYCHIC'S OWN DEVICE then notices it is psychic
// with nothing stamped for this round, draws the target AND deals its own hand
// of cards, and writes both to rooms/{code}/secrets/{psychicId} — a node whose
// rules let only its owner read it. No other device computes any of it, so no
// other device can hold it.
//
// That the psychic's device can deal at all is worth stating: the roster in
// state/ carries each player's WHOLE profile, anime list included, so
// eligibleCards is computable anywhere. It is computed here and only here.
//
// It is also what makes player-written spectra possible. The host has never seen
// them; the psychic has. Because this device chooses, its own spectra can be on
// the menu, and only the one it picks is ever published.
//
// The cost of all this is real and is not papered over: the psychic is the sole
// holder, so the target reaches the room only when they publish it at the moment
// the dials lock. A psychic who disappears in between takes it with them and the
// round is abandoned. The tempting fix — have the host keep a backup — is
// strictly worse than the concession it imitates, because the host is a guesser
// this round and would be holding the answer they are being scored on.
const initialState = (localProfile) => ({
  view: 'lobby',
  hostId: localProfile.id,
  settings: null,
  game: null,
  totalScores: {},
  playedCardIds: [],
  players: [localProfile],
});

function normalizeState(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    players: Array.isArray(raw.players) ? raw.players.filter(Boolean) : [],
    totalScores: raw.totalScores ?? {},
    playedCardIds: rules.normalizePlayedCardIds(raw.playedCardIds),
    // The single point round state enters the hook — so nothing downstream, and
    // least of all rules.js, ever sees the shapes RTDB drops.
    game: rules.normalizeRound(raw.game),
  };
}

export function useWavelengthRoom() {
  const core = useRoomCore({
    storageKey: ROOM_KEY,
    playersPath: 'players',
    initialState,
    normalizeState,
  });
  const {
    roomCode, myPlayerId, state, isHost, players,
    patchState, guard, once, setSyncError, roster, serverOffset, serverOffsetRef,
  } = core;

  const game = state?.game ?? null;
  const settings = state?.settings ?? null;
  const playerIds = players.map((p) => p.id);
  const activeIds = roster.activeIds;
  const iAmPsychic = !!game && game.psychicId === myPlayerId;

  // --- the psychic's secret ---------------------------------------------------
  //
  // secrets/ is a SIBLING of state/, so useRoomCore's subscription never sees it
  // and this needs its own. Precedent: useAniFakeRoom's dealt-card listener, and
  // useRoom.js's assignments listener for the mirror-image rule.
  const [secret, setSecret] = useState(null);
  useEffect(() => {
    if (!roomCode || !myPlayerId) return undefined;
    const db = getFirebaseDb();
    const secretRef = ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`);
    const unsub = onValue(
      secretRef,
      (snap) => setSecret(snap.val() ?? null),
      () => setSecret(null),
    );
    return () => { unsub(); setSecret(null); };
  }, [roomCode, myPlayerId]);

  // A secret from a previous round is still sitting in that node. The stamp is
  // what makes it invisible rather than wrong — cards and targets are STAMPED,
  // never cleared, because a clear is a write that can half-fail and leave the
  // previous answer readable. Same trick as AniFake's forRound and AniGuess's
  // assignment stamp. It is also what makes a refresh mid-round work: both are
  // re-read from the room rather than from local state.
  //
  // Keyed on the STAMP rather than on the target being present, because in
  // readroom there legitimately is no target until the psychic places one —
  // testing the target would re-deal their hand out from under them.
  const mine = game && secret && secret.forRound === game.round ? secret : null;
  const myTarget = Number.isFinite(mine?.target) ? mine.target : null;
  const myHand = mine ? rules.normalizeHand(mine.hand) : [];

  /**
   * Draws this round's secret, on the psychic's device and nowhere else.
   *
   * Keyed on the round, because useRoomCore clears its one-shots on a VIEW
   * change and the view stays 'round' for the whole game — without the round in
   * the key this fires once and every later round would sit clueless forever.
   * The `redeal:${round}:${deal}` note in CLAUDE.md is the same lesson.
   */
  useEffect(() => {
    if (!roomCode || !myPlayerId || !game) return;
    if (!iAmPsychic || game.phase !== 'clue') return;
    if (mine) return;
    once(`secret:${game.round}:${myPlayerId}`, async () => {
      const db = getFirebaseDb();
      await set(ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`), {
        forRound: game.round,
        // readroom has no target to draw: the psychic's own dial becomes it,
        // and arrives by the update() in submitClue below.
        target: rules.drawsRandomTarget(game.mode) ? rules.pickTarget() : null,
        // readroom only. `cards` searches the pool on this same device instead
        // — see searchCards below — so it has nothing to be dealt, and writing
        // it a hand it never reads would leave myDealReady waiting on one.
        hand: rules.dealsHand(game.mode)
          ? dealHand(players, {
            pool: settings?.cardPool,
            sharedOnly: settings?.sharedOnly !== false,
            exclude: state?.playedCardIds ?? [],
            size: 1,
          })
          : null,
      });
    });
  }, [roomCode, myPlayerId, game, iAmPsychic, mine, once, players, settings, state]);

  // --- the searchable pool ----------------------------------------------------
  //
  // `cards` mode's replacement for the hand, and it never leaves this device.
  // The roster in state/ carries every player's whole profile, so the eligible
  // pool is computable anywhere — the same fact that lets the psychic deal
  // themselves a readroom card without the host's help. It is computed HERE and
  // only here, and only the card they play is published.
  //
  // Gated on being the psychic in a searching round, because this flattens every
  // seated player's whole anime list: a guesser would pay for a list they never
  // see. AniGuess's GameScreen does the same with its `talkMode ? [] : …` memo.
  //
  // Drawn from `players` rather than the active roster, matching the deal above:
  // sharedOnly means "everyone in this room has it", and a player who dropped
  // for thirty seconds should not silently widen the pool mid-round.
  const searchCards = useMemo(() => (
    iAmPsychic && game?.mode === 'cards'
      ? searchableCards(players, {
        pool: settings?.cardPool,
        sharedOnly: settings?.sharedOnly !== false,
        exclude: state?.playedCardIds ?? [],
      })
      : []
  ), [iAmPsychic, game?.mode, players, settings, state?.playedCardIds]);

  // --- round mutations -------------------------------------------------------
  //
  // Every mutation of the round funnels through one transaction on state/game so
  // two devices dialling at the same instant can't lose each other's write. The
  // callback re-normalizes, because a transaction callback sees the RAW stored
  // value rather than the subscription's repaired one.
  const applyRound = useCallback((fn) => {
    const db = getFirebaseDb();
    return runTransaction(ref(db, `rooms/${roomCode}/state/game`), (raw) => {
      const current = rules.normalizeRound(raw);
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
    // Deal from the players actually here: a departed player should not be handed
    // the psychic role on the very first round.
    const seated = roster.active.map((p) => p.id);
    const ids = seated.length ? seated : playerIds;
    await patchState({
      settings: nextSettings,
      totalScores: {},
      // null rather than [], because RTDB does not store an empty array — this
      // is a delete, which is what "nothing played yet" has to mean.
      playedCardIds: null,
      bankedRound: null,
      game: rules.startRound(ids, {
        psychicId: rules.psychicFor(ids, 0),
        round: 0,
        mode: nextSettings.clueMode,
      }),
      view: 'round',
    });
  }, [isHost, patchState, roster, playerIds]);

  /**
   * Everything the psychic publishes, plus — in readroom — the answer key.
   *
   * The placement goes into secrets/ FIRST and is awaited, because the instant
   * the phase turns to `guess` the reveal becomes reachable, and a reveal with
   * no target abandons the round. update() rather than set(), so the hand and
   * the round stamp beside it survive.
   */
  const submitClue = useCallback(async ({ spectrum, text, card, placement } = {}) => {
    if (Number.isFinite(placement)) {
      const db = getFirebaseDb();
      await guard(update(
        ref(db, `rooms/${roomCode}/secrets/${myPlayerId}`),
        { target: placement },
      ));
    }
    return applyRound((g) => {
      const result = rules.submitClue(g, myPlayerId, { spectrum, text, card });
      if (!Object.keys(result.patch).length) return result;
      // The countdown is stamped by the hook rather than by rules.js: a deadline
      // is an absolute wall-clock instant, which is exactly the kind of thing a
      // pure module must not invent. Written in the same transaction as the clue
      // so the guess phase can never exist without its clock.
      //
      // In SERVER time — Date.now() plus useRoomCore's measured skew — because
      // every device compares this against its own corrected clock. Stamping it
      // in the psychic's local time would hand a table with one badly-set clock
      // a guess window of the wrong length, or one that had already expired.
      if (!settings?.timed) return result;
      const at = Date.now() + serverOffsetRef.current + settings.guessSeconds * 1000;
      return { patch: { ...result.patch, deadline: at } };
    });
  }, [applyRound, guard, myPlayerId, roomCode, settings, serverOffsetRef]);

  const placeDial = useCallback((value) => (
    applyRound((g) => rules.placeDial(g, myPlayerId, value))
  ), [applyRound, myPlayerId]);

  const nextRound = useCallback(async () => {
    if (!isHost || !game) return;
    const next = game.round + 1;
    const ids = roster.activeIds.length ? roster.activeIds : playerIds;
    const played = game.card
      ? [...(state?.playedCardIds ?? []), game.card.id]
      : (state?.playedCardIds ?? []);
    await patchState({
      playedCardIds: played.length ? played : null,
      game: rules.startRound(ids, {
        psychicId: rules.psychicFor(ids, next),
        round: next,
        // From the round rather than from settings, so a mode cannot drift
        // mid-session if the lobby is ever able to write settings again.
        mode: game.mode,
        // Only when there is one: spectrumIdOf falls back to the default id,
        // which would silently bar that spectrum from every later round.
        excludeSpectrumId: game.spectrum ? spectrumIdOf(game.spectrum) : null,
      }),
    });
  }, [isHost, game, patchState, roster, playerIds, state]);

  const abandon = useCallback(() => applyRound(rules.abandonRound), [applyRound]);

  const finish = useCallback(() => (
    isHost ? patchState({ view: 'results' }) : undefined
  ), [isHost, patchState]);

  // Back to the lobby with the settings intact, so a table can retune and go
  // again without re-entering the room code.
  const returnToLobby = useCallback(() => (
    isHost ? patchState({ view: 'lobby', game: null, bankedRound: null }) : undefined
  ), [isHost, patchState]);

  // --- the countdown ---------------------------------------------------------
  const timer = useDeadline(game?.phase === 'guess' ? game?.deadline ?? null : null, {
    offsetMs: serverOffset,
    windowMs: settings?.timed ? settings.guessSeconds * 1000 : null,
  });

  // A SECOND clock, later by REVEAL_GRACE_MS, and it gates nothing but the
  // reveal. The bar every guesser watches has to drain to the real deadline —
  // that is the number they were promised — while the psychic's device has to
  // wait a moment past it, because expiry is exactly when a placed-but-unlocked
  // dial submits itself (see GuessView) and revealing on the same instant races
  // the writes it should be collecting. Two hooks rather than one shifted value
  // so neither purpose can quietly borrow the other's instant.
  //
  // Only ever armed in a timed round: with no deadline stamped this is null and
  // useDeadline runs no interval at all.
  const revealTimer = useDeadline(
    game?.phase === 'guess' && Number.isFinite(game?.deadline)
      ? game.deadline + rules.REVEAL_GRACE_MS
      : null,
    { offsetMs: serverOffset },
  );

  // --- publishing the target -------------------------------------------------
  //
  // The psychic's device alone, and only once every active guesser has dialled
  // (or the clock has run out). Never at clue time: a target sitting in state/
  // during the guess phase is readable by anyone watching raw RTDB however the
  // screens behave.
  const guessesIn = !!game && rules.everyoneGuessed(game, activeIds);
  useEffect(() => {
    if (!game || game.phase !== 'guess' || !iAmPsychic) return;
    if (myTarget == null) return;
    if (!guessesIn && !(settings?.timed && revealTimer.expired)) return;
    once(`reveal:${game.round}`, () => applyRound((g) => rules.revealTarget(g, myTarget)));
  }, [game, iAmPsychic, myTarget, guessesIn, settings, revealTimer.expired, once, applyRound]);

  /**
   * The psychic ending the guess phase by hand, with the dials that are in.
   *
   * THE HOST CANNOT OWN THIS, and that is not an oversight to tidy up later: a
   * reveal needs the target, and the psychic's device is its sole holder. This
   * is the same call the clock makes, reachable a round early.
   *
   * It exists because an UNTIMED round has no other ending. everyoneGuessed
   * counts the active roster, so a player who is connected and simply not
   * dialling — reading their phone, arguing about the clue — blocks it forever,
   * and presence never fires because nothing is wrong with their connection.
   * AniTune's revealNow is the same escape hatch against the same wedge.
   */
  const revealNow = useCallback(() => {
    if (!iAmPsychic || myTarget == null) return undefined;
    return applyRound((g) => rules.revealTarget(g, myTarget));
  }, [iAmPsychic, myTarget, applyRound]);

  // --- banking ---------------------------------------------------------------
  //
  // The host folds a revealed round into the totals, claimed with a
  // compare-and-set so a re-render — or two devices racing — cannot double-count
  // an applyRoundScores that is deliberately not idempotent.
  useEffect(() => {
    if (!isHost || !roomCode || !game) return;
    if (game.phase !== 'reveal' || game.abandoned) return;
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
  // What stays here is deciding what an absence BROKE — which for AniWave is
  // exactly one thing, and it has two very different answers depending on the
  // phase. See rules.skipDepartedPsychic.
  //
  // Keyed on the psychic as well as the round, so handing the role to a
  // successor who then also leaves re-arms it rather than latching.
  useEffect(() => {
    if (!game || !state || state.view !== 'round') return;
    if (game.phase === 'reveal') return;
    const departed = roster.departedIds;
    if (!departed.includes(game.psychicId)) return;
    once(`psychic:${game.round}:${game.psychicId}`, () => (
      applyRound((g) => rules.skipDepartedPsychic(g, playerIds, departed))
    ));
  }, [game, state, roster, playerIds, once, applyRound]);

  return {
    ...core,
    game,
    settings,
    // Null until the psychic picks one. Every screen that draws a dial is
    // behind the guess phase, which cannot open without one — see submitClue.
    spectrum: game?.spectrum ? getSpectrum(game.spectrum) : null,
    mode: game?.mode ?? rules.DEFAULT_CLUE_MODE,
    card: game?.card ?? null,
    // readroom's dealt card. Only ever non-empty on the psychic's device.
    myHand,
    // `cards` mode's pool to search. Empty on every other device and in every
    // other mode — see above.
    searchCards,
    // Only ever non-null on the psychic's device before the reveal; everyone
    // reads the published value off the round afterwards.
    myTarget,
    // True once this device has drawn (or been handed) whatever it needs to
    // start clueing — which in readroom is a card and no target at all.
    myDealReady: !!mine && (!rules.drawsRandomTarget(game?.mode) || myTarget != null)
      && (!rules.dealsHand(game?.mode) || myHand.length > 0),
    revealedTarget: game?.phase === 'reveal' ? game.target : null,
    iAmPsychic,
    psychic: players.find((p) => p.id === game?.psychicId) ?? null,
    myDial: game?.dials?.[myPlayerId] ?? null,
    iHaveDialled: rules.hasDialled(game, myPlayerId),
    pending: rules.pendingGuessers(game, activeIds),
    everyoneGuessed: guessesIn,
    // True once the dials can be ended by hand: the psychic, mid-guess, holding
    // a target. Derived here so a screen never has to reassemble the three.
    canRevealNow: !!game && game.phase === 'guess' && iAmPsychic && myTarget != null,
    explain: game ? rules.explainRound(game, playerIds) : [],
    roundScores: game ? rules.finalScores(game, playerIds) : {},
    totalScores: state?.totalScores ?? {},
    roundNumber: (game?.round ?? 0) + 1,
    totalRounds: settings?.rounds ?? 0,
    isFinalRound: (game?.round ?? 0) + 1 >= (settings?.rounds ?? 0),
    timer: settings?.timed ? timer : null,
    startGame,
    submitClue,
    placeDial,
    revealNow,
    nextRound,
    abandon,
    finish,
    returnToLobby,
    guard,
  };
}
