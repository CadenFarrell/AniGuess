import { useCallback, useState } from 'react';
import * as rules from '../rules';

// Local (single-device) persistence for one AniTune round. Mirrors how
// src/games/aniguess/hooks/useGameFlow.js wraps aniguess/rules.js: all the
// actual game logic lives in the pure module, this only decides where the state
// is kept. An online room would swap this hook for a Firebase-backed one with
// the same handler API and the components wouldn't change.
export function useAniTuneRound(players, mode, roundLength) {
  const [state, setState] = useState(() => rules.startRound(players, mode));

  // Rules run inside the updater so handlers always see current state — several
  // of them (buzzing, locking in) can fire in quick succession.
  const apply = useCallback((fn) => {
    setState((s) => ({ ...s, ...(fn(s).patch || {}) }));
  }, []);

  return {
    state,
    activeId: rules.activePlayerId(state),
    isLastQuestion: state.index + 1 >= roundLength,

    buzz: useCallback((playerId) => apply((s) => rules.buzz(s, playerId)), [apply]),
    resolveBuzz: useCallback(
      (question, guess) => apply((s) => rules.resolveBuzz(s, question, guess, players)),
      [apply, players]
    ),
    giveUp: useCallback(() => apply(rules.giveUp), [apply]),

    startGuessing: useCallback(() => apply(rules.startGuessing), [apply]),
    beginEntry: useCallback(() => apply(rules.beginEntry), [apply]),
    submitAnswer: useCallback(
      (question, text) => apply((s) => rules.submitAnswer(s, question, text)),
      [apply]
    ),

    advance: useCallback(
      () => apply((s) => rules.nextQuestion(s, players, roundLength)),
      [apply, players, roundLength]
    ),
  };
}
