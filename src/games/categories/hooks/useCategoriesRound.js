import { useCallback, useMemo, useState } from 'react';
import * as rules from '../rules';
import { dealCategories, getCategory } from '../categories';
import { DEFAULT_PREFS } from '../prefs';

// Local (single-device) persistence for an AniTag session. Mirrors
// src/games/wavelength/hooks/useWavelengthRound.js: all the actual game logic
// lives in the pure module, and this only decides where the state is kept.
//
// THE CATEGORIES ARE HELD OUTSIDE ROUND STATE, exactly as they are online.
// There they have to be, because round state is the subtree every member of a
// room subscribes to in full; here it is a choice, and the reason is the same
// one stated differently — a value that is not in the object the screens render
// cannot be leaked by a screen rendering the wrong field.
//
// IT CANNOT GO AS FAR AS ONLINE DOES, AND THAT IS WORTH STATING PLAINLY RATHER
// THAN IMPLYING OTHERWISE. Online, a clause is held off the wrong device by a
// Firebase rule; here one device holds every slot, so the only thing between a
// player and somebody else's clause is that they are not looking. That is the
// same trust local play already asks for in AniGuess (whose PeekPanel this
// game's peek strip copies) and in AniFake's blind mode.
//
// THE TWO MODES ASK FOR THAT TRUST AT DIFFERENT MOMENTS, WHICH IS WHY CHOSEN
// MODE IS THE EASIER ONE ON A SHARED DEVICE:
//
//   dealt   the hot seat must not see their own clause, and it has to be on
//           screen all turn for the judge to rule from. Hence CategoryPeek.
//   chosen  a clause only has to be on screen ONCE, while its owner picks it —
//           after that every judge rules from memory, so the whole rest of the
//           turn can sit in the middle of the table with nothing hidden on it.
//           The pick is the only handover, and it happens once per round.
//
// THE ROUND AND THE SCORE HISTORY ARE ONE useState, and that is load-bearing
// rather than tidy. Folding a round into the totals must happen exactly once —
// rules.applyRoundScores is deliberately not idempotent — and here the gate is
// structural: nextTurn already refuses to fire outside a turn end, so appending
// to `history` in the same updater inherits that guarantee for free.
export function useCategoriesRound(players, {
  rounds = DEFAULT_PREFS.rounds,
  proposalCap = DEFAULT_PREFS.proposalCap,
  categoryPool = DEFAULT_PREFS.categoryPool,
  categoryMode = DEFAULT_PREFS.categoryMode,
  customCategories = [],
} = {}) {
  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const chosen = categoryMode === 'chosen';

  /**
   * A fresh clause for everybody — in dealt mode only.
   *
   * Called OUTSIDE React's updaters, always: it reaches Math.random, and React
   * is free to invoke an updater more than once (StrictMode does so
   * deliberately), which would deal a different round each time. Chosen mode
   * starts empty and fills as each player picks; nothing random happens at all.
   */
  const deal = useCallback((exclude = []) => (chosen ? {} : dealCategories(playerIds, Math.random, {
    pool: categoryPool,
    extra: customCategories,
    exclude,
  })), [chosen, playerIds, categoryPool, customCategories]);

  // Lazy initializers, so a re-render can never re-deal the round. Both reach
  // Math.random in dealt mode.
  const [session, setSession] = useState(() => ({
    round: rules.startRound(playerIds, {
      round: 0, cap: proposalCap, mode: categoryMode,
    }),
    history: [],
  }));
  const [categories, setCategories] = useState(deal);
  const state = session.round;

  const apply = useCallback((fn) => {
    setSession((s) => {
      const { patch } = fn(s.round);
      if (!patch || Object.keys(patch).length === 0) return s;
      return { ...s, round: { ...s.round, ...patch } };
    });
  }, []);

  /**
   * CHOSEN MODE: publishes every clause the round is now willing to show.
   *
   * Online this is one device publishing its own and nobody else's, because
   * secrets/ is read-gated to its owner. Here one device holds them all, so it
   * does the same job in a loop — and it is still rules.publishCategory that
   * decides WHICH may go, so local and online reveal exactly the same set at
   * exactly the same moments. Threading `cur` through the loop is what makes
   * the accumulated patch complete rather than each entry overwriting the last.
   */
  const revealWhatIsAllowed = useCallback((round, cats) => {
    let cur = round;
    let patch = {};
    for (const id of playerIds) {
      const { patch: p } = rules.publishCategory(cur, id, cats[id]);
      if (!Object.keys(p).length) continue;
      cur = { ...cur, ...p };
      patch = { ...patch, ...p };
    }
    return patch;
  }, [playerIds]);

  /**
   * Whatever has to happen alongside a turn or round ending.
   *
   * The two modes publish opposite things and this is the one place that knows:
   * dealt attaches the seat's clause to their result (somebody else's job
   * online, since the seat is denied it), chosen publishes every clause that is
   * no longer worth points. Everything else about ending a turn is identical.
   */
  const closing = useCallback((next, seatId, cats) => (
    chosen
      ? revealWhatIsAllowed(next, cats)
      : rules.attachCategory(next, seatId, cats[seatId]).patch
  ), [chosen, revealWhatIsAllowed]);

  /** CHOSEN MODE: one player commits the clause only they will know. */
  const pick = useCallback((playerId, spec) => {
    const category = rules.toSpec(spec);
    if (!category || !playerId) return;
    setCategories((c) => ({ ...c, [playerId]: category }));
    apply((r) => {
      const picked = rules.recordPick(r, playerId);
      if (!Object.keys(picked.patch).length) return picked;
      // Opening the first turn is part of the same commit rather than an
      // effect: locally the last pick and the start of play are one tap, and a
      // separate effect would repaint the pass screen once more first.
      const begun = rules.beginNaming({ ...r, ...picked.patch }, playerIds);
      return { patch: { ...picked.patch, ...begun.patch } };
    });
  }, [apply, playerIds]);

  const propose = useCallback((text) => {
    // Resolves the seat out of the state being written to rather than from a
    // prop, so a double tap cannot name something for whoever the first tap
    // already moved past.
    apply((r) => rules.proposeName(r, r.seatId, text));
  }, [apply]);

  const declare = useCallback((guess, targetId = null) => {
    apply((r) => rules.declareCategory(r, r.seatId, guess, targetId));
  }, [apply]);

  /**
   * One judge rules — and, in the same updater, publishes whatever that made
   * publishable.
   *
   * Online those are separate writes from separate devices, because no device
   * holds more than its own clause. Here one device holds every slot, so the
   * answer is attached the instant it is allowed out and the reveal never has a
   * gap. Same rules functions either way.
   */
  const rule = useCallback((judgeId, verdict) => {
    apply((r) => {
      const required = rules.requiredJudges(r, playerIds);
      // The roster goes in so rules.judge can hand the seat to the next player:
      // a settled name moves it, which is the whole shape of a round. No
      // skipIds — locally the roster IS the active roster.
      const judged = rules.judge(r, judgeId, verdict, required, playerIds);
      if (!Object.keys(judged.patch).length) return judged;
      const next = { ...r, ...judged.patch };
      if (next.phase !== 'turnEnd') return judged;
      return { patch: { ...judged.patch, ...closing(next, r.seatId, categories) } };
    });
  }, [apply, categories, closing, playerIds]);

  const pass = useCallback(() => {
    apply((r) => {
      const passed = rules.passTurn(r, r.seatId);
      if (!Object.keys(passed.patch).length) return passed;
      const next = { ...r, ...passed.patch };
      return { patch: { ...passed.patch, ...closing(next, r.seatId, categories) } };
    });
  }, [apply, categories, closing]);

  // Moves the seat on, and banks the round when there is no seat left to move
  // to — see the header for why those are one updater. The round ending is also
  // the moment every clause still standing becomes publishable, which is why
  // this reaches for `closing` too and not only the turn does.
  const nextTurn = useCallback(() => {
    setSession((s) => {
      const { patch } = rules.nextTurn(s.round, playerIds);
      if (!patch || Object.keys(patch).length === 0) return s;
      let round = { ...s.round, ...patch };
      if (round.phase !== 'roundEnd') return { ...s, round };
      if (chosen) round = { ...round, ...revealWhatIsAllowed(round, categories) };
      return { ...s, round, history: [...s.history, rules.finalScores(round, playerIds)] };
    });
  }, [categories, chosen, playerIds, revealWhatIsAllowed]);

  /**
   * Deals — or clears for re-picking — the next round.
   *
   * In dealt mode the categories are drawn OUT HERE and handed to the setter as
   * a plain value, never computed inside an updater (see deal), and last
   * round's clauses are excluded so a short session cannot hand somebody
   * straight back the one they just solved. In chosen mode there is nothing to
   * draw: the map empties and the round opens on `picking`.
   */
  const nextRound = useCallback(() => {
    const exclude = Object.values(categories);
    setCategories(deal(exclude));
    setSession((s) => ({
      ...s,
      round: rules.startRound(playerIds, {
        round: s.round.round + 1, cap: proposalCap, mode: categoryMode,
      }),
    }));
  }, [categories, categoryMode, deal, playerIds, proposalCap]);

  const totalScores = useMemo(
    () => session.history.reduce((acc, scores) => rules.applyRoundScores(acc, scores), {}),
    [session.history],
  );

  // Locally the roster IS the active roster: there is no departure to skip, one
  // device holds every seat in turn.
  const seatId = state.seatId;
  const judgeIds = rules.requiredJudges(state, playerIds);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  return {
    state,
    chosen,
    seat: byId.get(seatId) ?? null,
    // Who still owes an answer, in the order they will be asked. Dealt mode's
    // list is always one long; chosen mode's is everyone but the seat, minus
    // whoever has already tapped.
    judges: judgeIds.map((id) => byId.get(id)).filter(Boolean),
    pendingJudges: judgeIds
      .filter((id) => typeof state.pending?.verdicts?.[id] !== 'boolean')
      .map((id) => byId.get(id))
      .filter(Boolean),
    // DEALT MODE's hidden value, and the only way a screen can reach it. Never
    // spread into anything else on this object — see the header.
    seatCategory: !chosen && seatId ? getCategory(categories[seatId]) : null,
    /**
     * CHOSEN MODE: one player's own clause, for a reminder they ask for.
     *
     * A FUNCTION RATHER THAN THE MAP, deliberately. Handing back `categories`
     * would put every clause in the room on every screen's props and make the
     * whole hidden half of the game one careless render away from the table;
     * asking for one by id is a thing a screen has to do on purpose, and there
     * is exactly one caller (the peek behind a judge's own name).
     */
    categoryFor: (playerId) => (
      chosen && categories[playerId] ? getCategory(categories[playerId]) : null
    ),
    hasPicked: (playerId) => rules.hasPicked(state, playerId),
    // Who the seat may still claim. Empty in dealt mode, and legitimately empty
    // in chosen mode once every other player has been solved.
    declarable: rules.declarableIds(state, playerIds).map((id) => byId.get(id)).filter(Boolean),
    pending: state.pending,
    trail: rules.trailFor(state, seatId),
    // EVERY trail, not just the seat's. The seat moves after each name, so a
    // screen showing only whoever is up would hide the evidence a player spent
    // the round collecting the moment they passed the device on.
    trails: state.trails,
    used: rules.proposalsUsed(state, seatId),
    left: rules.proposalsLeft(state, seatId),
    usedFor: (playerId) => rules.proposalsUsed(state, playerId),
    leftFor: (playerId) => rules.proposalsLeft(state, playerId),
    // The rotation, and what the table just watched happen. Both exist because
    // a missed declaration no longer stops the round to announce itself.
    order: rules.turnOrder(state, playerIds).map((row) => ({
      ...row, name: byId.get(row.playerId)?.name ?? 'Someone',
    })),
    lastPlayed: state.lastPlayed ?? null,
    cap: state.cap,
    phase: state.phase,
    roundNumber: state.round + 1,
    totalRounds: rounds,
    isFinalRound: state.round + 1 >= rounds,
    explain: rules.explainRound(state, playerIds, chosen ? {} : categories),
    roundScores: rules.finalScores(state, playerIds),
    totalScores,
    pick,
    propose,
    declare,
    rule,
    pass,
    nextTurn,
    nextRound,
  };
}
