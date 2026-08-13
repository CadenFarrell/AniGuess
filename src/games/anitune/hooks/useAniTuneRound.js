import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeadline } from '../../../shared/hooks/useDeadline';
import * as rules from '../rules';

// Local (single-device) persistence for one AniTune round. Mirrors how
// src/games/aniguess/hooks/useGameFlow.js wraps aniguess/rules.js: all the
// actual game logic lives in the pure module, this only decides where the state
// is kept. The online twin (useAniTuneRoom) swaps the storage for Firebase and
// keeps the same handler API, so the components don't branch.
//
// The clock is the one place local and online genuinely differ, and only in
// where "now" comes from: there is a single device here, so Date.now() is the
// shared clock by definition and no server offset is involved.
// `initialState` resumes a saved round instead of dealing a fresh one. It has
// already been through rules.resumeRound, which is what guarantees it is sitting
// at a question boundary with no expired clock in it — this hook takes it as
// given rather than re-checking, the same way it takes startRound's output.
export function useAniTuneRound(players, mode, roundLength, settings = {}, initialState = null) {
  const [state, setState] = useState(() => initialState ?? rules.startRound(players, mode, settings));

  // Rules run inside the updater so handlers always see current state — several
  // of them (buzzing, locking in) can fire in quick succession.
  const apply = useCallback((fn) => {
    setState((s) => ({ ...s, ...(fn(s).patch || {}) }));
  }, []);

  const clock = useDeadline(state.deadlineAt, { windowMs: state.windowMs });

  // The current question, needed to grade the blank answers an expiry records.
  // Held in a ref because the expiry effect must not re-run just because the
  // parent re-rendered with a new object identity for the same question.
  const questionRef = useRef(null);
  const setQuestion = useCallback((q) => { questionRef.current = q; }, []);

  // Time ran out. Fires once per expiry: expireQuestion clears deadlineAt on
  // its way to 'revealed', so `clock.expired` goes false again and this cannot
  // re-enter. The rule is idempotent regardless.
  useEffect(() => {
    if (!clock.expired) return;
    apply((s) => rules.expireQuestion(s, questionRef.current, players.map((p) => p.id), Date.now()));
  }, [clock.expired, apply, players]);

  return {
    state,
    activeId: rules.activePlayerId(state),
    isLastQuestion: state.index + 1 >= roundLength,
    // The countdown the round screen renders. Paused during a handoff, where
    // the device is between hands and nobody is being timed.
    clock,
    setQuestion,

    // Opened when the clip actually starts, not when the question is dealt —
    // see rules.openWindow. Pass-and-play is the exception and deliberately
    // does NOT open here: its window belongs to whoever is holding the device,
    // so beginEntry opens one per player. Opening a shared one at clip start
    // would leave a deadline running through the 'listening' phase, where the
    // table is still deciding to start, and expire the question before anyone
    // had a turn.
    openWindow: useCallback(() => {
      if (!rules.isRace(mode)) return;
      apply((s) => rules.openWindow(s, Date.now()));
    }, [apply, mode]),

    buzz: useCallback((playerId) => apply((s) => rules.buzz(s, playerId, Date.now())), [apply]),
    resolveBuzz: useCallback(
      (question, guess) => apply((s) => rules.resolveBuzz(s, question, guess, players, Date.now())),
      [apply, players]
    ),
    giveUp: useCallback(
      () => apply((s) => rules.giveUp(s, players.map((p) => p.id))),
      [apply, players]
    ),

    startGuessing: useCallback(() => apply(rules.startGuessing), [apply]),
    beginEntry: useCallback(() => apply((s) => rules.beginEntry(s, Date.now())), [apply]),
    submitAnswer: useCallback(
      (question, text) => apply((s) => rules.submitAnswer(s, question, text, Date.now())),
      [apply]
    ),

    // Returns whether the round is over, because in Lives mode that is not
    // something the caller can work out from the question index: the round also
    // ends the moment one player is left standing. Read from the current state
    // rather than from the patch, since a finished round patches nothing.
    advance: useCallback(() => {
      const { finished } = rules.nextQuestion(state, players, roundLength);
      if (!finished) apply((s) => rules.nextQuestion(s, players, roundLength));
      return finished;
    }, [state, apply, players, roundLength]),
  };
}
