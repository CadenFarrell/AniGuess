import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';

// Local (single-device) persistence for one AniFake round. Mirrors
// src/games/anirank/hooks/useAniRankRound.js: all the actual game logic lives in
// the pure module, this only decides where the state is kept.
//
// One thing genuinely differs from the online twin, and it is a simplification
// rather than a divergence: the deal never leaves this device, so there is no
// need for the publish-your-own-card reveal that rules.deriveTruth exists for.
// The truth is right here in `deal`. Online has to reconstruct it precisely
// because no device there is allowed to hold it.
export function useAniFakeRound(players, pool, {
  mode = 'blind', laps = 1, wordLimit = 1, fame, allowRedeal = false,
} = {}) {
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);

  // Lazy initializer, so a re-render can never re-deal the round.
  const [initialState] = useState(() => (
    rules.startRound(playerIds, { mode, laps, wordLimit, allowRedeal })
  ));
  const [state, setState] = useState(initialState);

  // The deal is its own state rather than part of the frozen tuple above,
  // because the card check can replace it without the round restarting. The
  // history of what has been dealt rides along as the exclusion list — and
  // unlike the online twin, keeping it here discloses nothing new: this device
  // already holds the whole deal, which is the simplification the note at the
  // top of this file is about.
  const [dealState, setDealState] = useState(() => {
    const first = rules.dealRoles(playerIds, pool, { mode, fame, deal: 1 });
    // `discarded` rides along beside `dealt` and is deliberately not derived from
    // it: `dealt` is folded ids for exclusion and includes the decoy, while this
    // is display names of superseded SECRETS only, and it goes on screen.
    return { deal: first, dealNumber: 1, dealt: first.dealt, discarded: [] };
  });
  const { deal, dealNumber } = dealState;

  // The deal is computed OUT HERE and handed to setDealState as a plain value,
  // rather than inside an updater. dealRoles calls Math.random, and React
  // requires updaters to be pure functions of the previous state: it is free to
  // invoke them more than once — StrictMode does so deliberately, and a re-based
  // render queue does so incidentally — and every extra invocation would deal a
  // DIFFERENT round. Reading `dealState` from the closure is safe because this
  // only ever runs from an event handler, and `dealState` is in the dep list so
  // each deal gets a fresh callback.
  //
  // The cap is still enforced here as well as at the call site, for startRound's
  // reason: this is the layer that has to hold. Note it now guards a value read
  // before the write rather than one handed in by React, so it cannot be relied
  // on to re-check state that moved underneath it — one tap, one deal.
  const redeal = useCallback(() => {
    if (dealState.dealNumber >= rules.MAX_DEALS) return;
    const next = dealState.dealNumber + 1;
    // The character just thrown away joins the published list, so the fake
    // shares the crew's knowledge of it — see the note on dealRoles' card.
    // filter(Boolean) because secretName is null on an empty pool.
    const discarded = [...dealState.discarded, dealState.deal.secretName].filter(Boolean);
    // The fake carries over — a re-deal answers a bad draw, not a role you did
    // not want. Free here, unlike online: this device already holds the whole
    // deal, so the pin costs no exposure the note at the top of the file does
    // not already cover. See rules.dealRoles' pinFake.
    const fresh = rules.dealRoles(playerIds, pool, {
      mode,
      fame,
      deal: next,
      exclude: dealState.dealt,
      pinFake: dealState.deal.fakeId,
      discarded,
    });
    setDealState({
      deal: fresh,
      dealNumber: next,
      dealt: [...dealState.dealt, ...fresh.dealt],
      discarded,
    });
  }, [dealState, playerIds, pool, mode, fame]);

  const apply = useCallback((fn) => {
    setState((s) => {
      const { patch } = fn(s);
      if (!patch || Object.keys(patch).length === 0) return s;
      return { ...s, ...patch };
    });
  }, []);

  const submitClue = useCallback((text) => {
    apply((s) => rules.submitClue(s, rules.currentSpeakerId(s), text));
  }, [apply]);

  // Talk mode's "said it" button. Resolves the speaker from the state it is
  // advancing, exactly as submitClue does, so a double tap cannot skip whoever
  // the first tap already moved the turn to.
  const passTurn = useCallback(() => {
    apply((s) => rules.passTurn(s, rules.currentSpeakerId(s)));
  }, [apply]);

  const castVote = useCallback((voterId, targetId) => {
    apply((s) => rules.castVote(s, voterId, targetId));
  }, [apply]);

  // Opens the sudden-death ballot after a tie. A no-op unless the round is
  // genuinely tied, so LocalRound can wire it straight to a button.
  const openRunoff = useCallback(() => {
    apply(rules.openRunoff);
  }, [apply]);

  const submitSteal = useCallback((name) => {
    apply((s) => rules.submitSteal(s, name));
  }, [apply]);

  // The dealt secret is a pool entry, not a published card, so it has no `key`
  // — and scoreRound folds the steal against one. Stamping it here keeps
  // scoreRound taking the same shape whichever half of the app calls it.
  const truth = {
    fakeId: deal.fakeId,
    secret: deal.secret ? rules.revealCardFor({ character: deal.secret }) : null,
    // What the fake was holding, in the same published-card shape the online
    // half derives — the decoy character in decoy mode, the confession and its
    // hint in blind. Built through revealCardFor rather than read off the deal
    // directly so the results screen sees one shape whichever half fed it.
    fakeCard: deal.fakeId ? rules.revealCardFor(deal.secrets[deal.fakeId]) : null,
  };

  return {
    state,
    // What each player was dealt, for the pass-the-device reveal. Keyed by id,
    // so the reveal screen walks the roster rather than the turn order.
    secrets: deal.secrets,
    // The pre-clue card check. `needsCheck` is off when the table turned it off;
    // `canRedeal` is what keeps the walk's last button phase-neutral, so nobody
    // learns from a label that someone asked.
    needsCheck: rules.needsCheck(state),
    canRedeal: dealNumber < rules.MAX_DEALS,
    dealNumber,
    redeal,
    // The roster in the round's speaking order, each row carrying a fixed seat.
    // Every in-round screen renders this rather than `players`, which is what
    // stops a name sitting at a different position on each screen.
    seatedPlayers: rules.seating(state, players),
    ...truth,
    speaker: players.find((p) => p.id === rules.currentSpeakerId(state)) ?? null,
    lap: rules.lapOf(state),
    // From the round, not from settings: startRound clamps `laps` into range,
    // and the order is fixed at deal time — so a typed lap count out of bounds
    // or a roster that changed underneath cannot desync the progress readout.
    totalTurns: rules.totalTurns(state),
    cluesDone: rules.cluesDone(state),
    // Both follow whichever ballot is open, so a runoff waits on its own votes
    // rather than reading as done from the opening one.
    everyoneVoted: rules.everyoneVoted(state, playerIds),
    ballot: rules.currentBallot(state),
    // The whole vote in one object — LocalRound reads needsRunoff off it to slot
    // the tie interstitial in, and `candidates` to name who tied.
    outcome: rules.voteOutcome(state),
    // Locally the roster is the electorate: there is no departure to skip, one
    // device holds every seat in turn.
    voterIds: playerIds,
    needsSteal: rules.needsSteal(state, deal.fakeId),
    // Not memoized: it is a walk over one round's votes, and memoizing it would
    // mean keying on a `truth` object rebuilt every render anyway.
    scores: rules.scoreRound(state, truth),
    submitClue,
    passTurn,
    castVote,
    openRunoff,
    submitSteal,
  };
}
