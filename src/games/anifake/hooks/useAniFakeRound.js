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
export function useAniFakeRound(players, pool, { mode = 'blind', laps = 1, wordLimit = 1 } = {}) {
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);

  // One lazy initializer for both, so a re-render can never re-deal the round.
  const [{ state: initialState, deal }] = useState(() => ({
    state: rules.startRound(playerIds, { mode, laps, wordLimit }),
    deal: rules.dealRoles(playerIds, pool, { mode }),
  }));
  const [state, setState] = useState(initialState);

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
    ...truth,
    speaker: players.find((p) => p.id === rules.currentSpeakerId(state)) ?? null,
    lap: rules.lapOf(state),
    // From the round, not from settings: startRound clamps `laps` into range,
    // and the order is fixed at deal time — so a typed lap count out of bounds
    // or a roster that changed underneath cannot desync the progress readout.
    totalTurns: rules.totalTurns(state),
    cluesDone: rules.cluesDone(state),
    everyoneVoted: rules.everyoneVoted(state, playerIds),
    needsSteal: rules.needsSteal(state, deal.fakeId),
    // Not memoized: it is a walk over one round's votes, and memoizing it would
    // mean keying on a `truth` object rebuilt every render anyway.
    scores: rules.scoreRound(state, truth),
    submitClue,
    passTurn,
    castVote,
    submitSteal,
  };
}
