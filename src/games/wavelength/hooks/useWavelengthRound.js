import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as rules from '../rules';
import { getSpectrum, spectrumIdOf } from '../spectra';
import { dealHand, searchableCards } from '../utils/cards';

// Local (single-device) persistence for an AniWave session. Mirrors
// src/games/anifake/hooks/useAniFakeRound.js: all the actual game logic lives in
// the pure module, this only decides where the state is kept.
//
// THE PSYCHIC'S SECRET IS HELD OUTSIDE ROUND STATE, exactly as it is online.
// There it has to be, because round state is the subtree every member of a room
// subscribes to in full; here it is a choice, and the reason is the same one
// stated a different way — a value that is not in the object the screens render
// cannot be leaked by a screen rendering the wrong field. What guards it in play
// is the pass-the-device gate; what guards it in code is this.
//
// It goes further than online can: both `target` and `hand` below are withheld
// from the return value entirely during the guess phase, which is the window
// when this device is in a guesser's hands. The psychic sees them while clueing,
// everyone sees the target at the reveal, and in between neither is reachable
// from a component at all. The hand is never revealed to anyone: the four cards
// that were not played are not part of the round.
//
// THE ROUND AND THE SCORE HISTORY ARE ONE useState, and that is load-bearing
// rather than tidy. Folding a round into the totals must happen exactly once —
// rules.applyRoundScores is deliberately not idempotent, and every game in the
// arcade gates it somehow. Here the gate is structural: revealTarget already
// refuses to fire outside the guess phase, so appending to `history` in the same
// updater inherits that guarantee for free. The alternative — bank in an effect
// watching for phase === 'reveal' — needs its own ref to dedupe AND triggers the
// cascading re-render the react-hooks/set-state-in-effect rule exists to catch.
export function useWavelengthRound(players, {
  rounds = 8, mode = rules.DEFAULT_CLUE_MODE, cardPool = 'characters', sharedOnly = true,
} = {}) {
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);

  /**
   * Everything the psychic alone gets to see this round.
   *
   * One function for both halves because they are drawn together and discarded
   * together. In readroom there is no target to draw — the psychic's own dial
   * becomes it — so this deals them a single card and leaves target null until
   * they place it.
   *
   * readroom is now the ONLY mode with a hand: `cards` searches the pool rather
   * than being dealt from it (see searchCards below), and `text` never touched
   * one. rules.dealsHand is the predicate; rules.needsCardPool is the different
   * question the setup screen asks.
   *
   * Called OUTSIDE React's updaters, always: it calls Math.random, and React is
   * free to invoke an updater more than once (StrictMode does so deliberately),
   * which would deal a different round each time.
   */
  const dealSecret = useCallback((exclude = []) => ({
    target: rules.drawsRandomTarget(mode) ? rules.pickTarget() : null,
    hand: rules.dealsHand(mode)
      // One card: it is the thing being judged, so there is nothing to choose
      // between.
      ? dealHand(players, { pool: cardPool, sharedOnly, exclude, size: 1 })
      : [],
  }), [players, mode, cardPool, sharedOnly]);

  // Lazy initializers, so a re-render can never re-deal the round or re-draw the
  // secret. Both reach Math.random.
  const [session, setSession] = useState(() => ({
    round: rules.startRound(playerIds, { round: 0, mode }),
    history: [],
    // Grows by one card a round, and outlives every round — its whole job is
    // stopping a small shared pool dealing the same card twice in a session.
    playedCardIds: [],
  }));
  const [secret, setSecret] = useState(dealSecret);
  const state = session.round;

  // Read inside callbacks that must not close over a stale render's secret.
  const secretRef = useRef(secret);
  useEffect(() => { secretRef.current = secret; }, [secret]);

  const apply = useCallback((fn) => {
    setSession((s) => {
      const { patch } = fn(s.round);
      if (!patch || Object.keys(patch).length === 0) return s;
      return { ...s, round: { ...s.round, ...patch } };
    });
  }, []);

  /**
   * Everything the psychic publishes, in one go.
   *
   * `placement` is readroom's answer key — the psychic's own dial. It is
   * committed to the secret BEFORE the round advances, in the same handler, for
   * the same reason the online hook writes it to secrets/ first: the moment the
   * phase turns to `guess` the reveal becomes reachable, and a reveal with no
   * target abandons the round.
   */
  const submitClue = useCallback(({ spectrum, text, card, placement } = {}) => {
    if (Number.isFinite(placement)) {
      setSecret((s) => ({ ...s, target: placement }));
      secretRef.current = { ...secretRef.current, target: placement };
    }
    apply((r) => rules.submitClue(r, r.psychicId, { spectrum, text, card }));
  }, [apply]);

  // Resolves nothing from a prop: the hot seat is read out of the state being
  // written to, so a double tap cannot place a dial for whoever the first tap
  // already advanced past.
  const placeDial = useCallback((playerId, value) => {
    apply((r) => rules.placeDial(r, playerId, value));
  }, [apply]);

  // Reveals AND banks, in one pure updater — see the header.
  const reveal = useCallback(() => {
    const at = secretRef.current.target;
    setSession((s) => {
      const { patch } = rules.revealTarget(s.round, at);
      if (!patch || Object.keys(patch).length === 0) return s;
      const round = { ...s.round, ...patch };
      return { ...s, round, history: [...s.history, rules.finalScores(round, playerIds)] };
    });
  }, [playerIds]);

  const abandon = useCallback(() => {
    // Nothing is appended: an abandoned round scores nothing, and finalScores
    // would return {} for it anyway.
    apply(rules.abandonRound);
  }, [apply]);

  /**
   * Deals the next round.
   *
   * The secret is drawn OUT HERE and handed to the setter as a plain value,
   * never computed inside an updater — see dealSecret. The same reason
   * anifake's redeal is written this way.
   */
  const nextRound = useCallback(() => {
    const played = state.card
      ? [...session.playedCardIds, state.card.id]
      : session.playedCardIds;
    const round = state.round + 1;
    setSecret(dealSecret(played));
    setSession((s) => ({
      ...s,
      playedCardIds: played,
      round: rules.startRound(playerIds, {
        round,
        mode,
        // Only when there is one to exclude: spectrumIdOf falls back to the
        // default id, which would silently bar 'filler' from round two.
        excludeSpectrumId: s.round.spectrum ? spectrumIdOf(s.round.spectrum) : null,
      }),
    }));
  }, [state.round, state.card, session.playedCardIds, playerIds, mode, dealSecret]);

  const totalScores = useMemo(
    () => session.history.reduce((acc, scores) => rules.applyRoundScores(acc, scores), {}),
    [session.history],
  );

  // Locally the roster IS the active roster: there is no departure to skip, one
  // device holds every seat in turn.
  const pending = rules.pendingGuessers(state, playerIds);
  const guessing = state.phase === 'guess';

  // `cards` mode's replacement for the hand — the pool the psychic searches,
  // minus everything this session has already played. Only built while the
  // psychic is actually clueing: this flattens every seated player's whole anime
  // list, and there is nobody to search during the guess phase (the device is in
  // a guesser's hands) or at the reveal.
  const searchCards = useMemo(() => (
    state.mode === 'cards' && state.phase === 'clue'
      ? searchableCards(players, {
        pool: cardPool, sharedOnly, exclude: session.playedCardIds,
      })
      : []
  ), [state.mode, state.phase, players, cardPool, sharedOnly, session.playedCardIds]);

  return {
    state,
    mode: state.mode,
    // Null until the psychic picks one — this hook never chooses, exactly as
    // the host never chooses online. See PsychicView.
    spectrum: state.spectrum ? getSpectrum(state.spectrum) : null,
    card: state.card,
    excludeSpectrumId: state.excludeSpectrumId,
    // Both withheld during the guess phase — see the header. Not merely hidden
    // by the screens: absent from what they are handed.
    target: guessing ? null : secret.target,
    hand: guessing ? [] : secret.hand,
    // Not withheld during the guess phase like the two above, because it is not
    // a secret at all — it is everyone's shared list. The memo already returns []
    // outside the clue phase, so nothing is built either way.
    searchCards,
    psychic: players.find((p) => p.id === state.psychicId) ?? null,
    roundNumber: state.round + 1,
    totalRounds: rounds,
    isFinalRound: state.round + 1 >= rounds,
    // The head of this is the hot seat, the way anirank's local play reads
    // pendingPlacers. Returning the whole list as well lets the pass screen say
    // how many are still to come.
    pending,
    hotSeatId: pending[0] ?? null,
    everyoneGuessed: rules.everyoneGuessed(state, playerIds),
    explain: rules.explainRound(state, playerIds),
    roundScores: rules.finalScores(state, playerIds),
    totalScores,
    submitClue,
    placeDial,
    reveal,
    nextRound,
    abandon,
  };
}
