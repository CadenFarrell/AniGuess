import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAP, MAX_CAP, MAX_PROPOSAL_LEN, MIN_CAP, MIN_PLAYERS, WRONG_DECLARATION_COST,
  applyRoundScores, beginNaming, claimedTargets, declarableIds, declareCategory,
  declaredTargets, everyonePicked, explainRound, finalScores, hasPicked, isChosen,
  judge, judgeIdFor, nextSeatId, nextTurn, normalizeGame, normalizePending,
  normalizeResults, normalizeTrail, normalizeTrails, passTurn, proposalsLeft,
  proposalsUsed, proposeName, publishCategory, recordPick, requiredJudges,
  revealAllowed, roundComplete, scoreTurn, settlePending, skipDepartedSeat,
  startRound, toSpec, trailFor, turnOrder, verdictsOf,
} from './rules';

const IDS = ['a', 'b', 'c'];
const apply = (state, { patch }) => ({ ...state, ...patch });

// Everyone who owes an answer gives the same one. Recomputing the required list
// per call would be wrong once the last verdict settles the pending and the
// list empties, so it is resolved up front — which is also how the hooks do it.
//
// THE ROSTER GOES IN AS WELL, and it has to: a settled name hands the seat to
// the next player, and judge cannot work out who that is without it. Leaving it
// off would leave every test below playing a game where the seat never moves —
// which is precisely the game this suite is here to say we no longer have.
const ruleAll = (state, verdict, ids = IDS, skip = []) => {
  const required = requiredJudges(state, ids, skip);
  let s = state;
  for (const id of required) s = apply(s, judge(s, id, verdict, required, ids, skip));
  return s;
};

// Drives `count` fully judged names, each by whoever holds the seat at the time
// — so it walks round the table rather than down one player's turn.
const withNames = (state, count, verdict = false, ids = IDS) => {
  let s = state;
  for (let i = 0; i < count; i++) {
    s = apply(s, proposeName(s, s.seatId, `name ${i}`));
    s = ruleAll(s, verdict, ids);
  }
  return s;
};

// Whole laps of the table, so EVERY player spends `laps` names and the seat
// comes back to whoever opened. "Give one player three names" is a lap-shaped
// question now, not a loop-shaped one.
const withLaps = (state, laps, verdict = false, ids = IDS) => (
  withNames(state, laps * ids.length, verdict, ids)
);

// A chosen round with the picking phase already satisfied, which is every test
// below that is about a turn rather than about the pick itself.
const chosenRound = (opts = {}) => {
  let s = startRound(IDS, { mode: 'chosen', ...opts });
  for (const id of IDS) s = apply(s, recordPick(s, id));
  return apply(s, beginNaming(s, IDS));
};

describe('startRound', () => {
  it('opens on the first player who is actually here', () => {
    expect(startRound(IDS).seatId).toBe('a');
    expect(startRound(IDS, { skipIds: ['a'] }).seatId).toBe('b');
  });

  it('starts with nothing decided and nothing pending', () => {
    const s = startRound(IDS);
    expect(s.phase).toBe('naming');
    expect(s.pending).toBeNull();
    expect(s.trails).toEqual({});
    expect(s.results).toEqual({});
  });

  // The clause is the one thing this game hides, in either mode, and startRound
  // is called by the host online. If one could reach round state it would be
  // readable by every member of the room watching raw RTDB.
  it('never puts a category anywhere in round state, in either mode', () => {
    for (const mode of ['dealt', 'chosen']) {
      const json = JSON.stringify(startRound(IDS, { round: 3, cap: 8, mode }));
      expect(json, mode).not.toMatch(/categor/i);
      expect(json, mode).not.toMatch(/assignment|secret/i);
    }
  });

  // The mode has to reach the round, because requiredJudges is the only branch
  // in the whole module and it reads nothing else.
  it('opens a chosen round on picking and a dealt one straight onto a turn', () => {
    expect(startRound(IDS, { mode: 'chosen' }).phase).toBe('picking');
    expect(isChosen(startRound(IDS, { mode: 'chosen' }))).toBe(true);
    expect(startRound(IDS, { mode: 'dealt' }).phase).toBe('naming');
    expect(isChosen(startRound(IDS, { mode: 'dealt' }))).toBe(false);
  });

  it('clamps the cap into range', () => {
    expect(startRound(IDS, { cap: 999 }).cap).toBe(MAX_CAP);
    expect(startRound(IDS, { cap: 0 }).cap).toBe(MIN_CAP);
    expect(startRound(IDS, { cap: 'nonsense' }).cap).toBe(DEFAULT_CAP);
  });

  it('needs two players — a hot seat and somebody to answer', () => {
    expect(MIN_PLAYERS).toBe(2);
  });
});

describe('toSpec', () => {
  it('accepts the two shapes categories.js resolves', () => {
    expect(toSpec('glasses')).toBe('glasses');
    expect(toSpec({ id: 'x', label: 'y', custom: true })).toEqual({ id: 'x', label: 'y', custom: true });
  });

  // RTDB does not store an empty object, so accepting {} would deal a turn
  // whose category reads back absent.
  it('rejects everything RTDB would decline to store', () => {
    for (const spec of [null, undefined, '', {}, [], 0, false]) {
      expect(toSpec(spec), JSON.stringify(spec)).toBeNull();
    }
  });
});

describe('nextSeatId', () => {
  it('is the first player still here who has not had a turn', () => {
    expect(nextSeatId(IDS, {}, [])).toBe('a');
    expect(nextSeatId(IDS, { a: { solved: true } }, [])).toBe('b');
    expect(nextSeatId(IDS, {}, ['a', 'b'])).toBe('c');
  });

  it('is null once nobody is left to take one', () => {
    expect(nextSeatId(IDS, { a: {}, b: {}, c: {} }, [])).toBeNull();
    expect(nextSeatId([], {}, [])).toBeNull();
  });

  // Chosen mode makes turn order worth money: every verdict is public, so the
  // last seat has heard (N-1) x cap answers about clauses they may declare and
  // the first heard none. Rotating spreads that across the session.
  it('rotates the opening seat with the round number, wrapping', () => {
    expect(startRound(IDS, { round: 0 }).seatId).toBe('a');
    expect(startRound(IDS, { round: 1 }).seatId).toBe('b');
    expect(startRound(IDS, { round: 2 }).seatId).toBe('c');
    expect(startRound(IDS, { round: 3 }).seatId).toBe('a');
  });

  // One name each, in order, from wherever the round opened — which is the
  // whole shape of a round now rather than the shape of one turn.
  it('still reaches everybody in turn when it starts partway round', () => {
    let s = startRound(IDS, { round: 1, cap: MIN_CAP });
    const seen = [];
    for (let i = 0; i < IDS.length; i++) {
      seen.push(s.seatId);
      s = withNames(s, 1);
    }
    expect(seen).toEqual(['b', 'c', 'a']);
  });

  // Passing 0 has to reproduce plain roster order exactly, or every existing
  // caller quietly changed behaviour.
  it('is plain roster order at startAt 0', () => {
    expect(nextSeatId(IDS, {}, [], 0)).toBe('a');
    expect(nextSeatId(IDS, {}, [], -1)).toBe('c');
  });
});

describe('judgeIdFor (dealt mode)', () => {
  it('is the next active player after the hot seat, wrapping', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS)).toBe('b');
    expect(judgeIdFor({ ...s, seatId: 'c' }, IDS)).toBe('a');
  });

  // The reason a departed judge needs no reconciliation effect, no one-shot and
  // no write: the role simply moves on the next render.
  it('steps over a departed judge with no state change at all', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS, ['b'])).toBe('c');
  });

  it('is null when nobody is left to answer', () => {
    const s = startRound(IDS);
    expect(judgeIdFor(s, IDS, ['b', 'c'])).toBeNull();
    expect(judgeIdFor({ seatId: null }, IDS)).toBeNull();
  });

  it('never names the hot seat as their own judge', () => {
    for (const seatId of IDS) {
      expect(judgeIdFor({ seatId }, IDS)).not.toBe(seatId);
    }
  });
});

// THE ONE BRANCH BETWEEN THE MODES. Everything else in rules.js is shared, so
// if this is wrong nothing else can be right.
describe('requiredJudges', () => {
  it('is the derived judge in dealt mode, for either kind of pending', () => {
    const s0 = startRound(IDS);
    const named = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(requiredJudges(named, IDS)).toEqual(['b']);
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses'));
    expect(requiredJudges(declared, IDS)).toEqual(['b']);
  });

  it('is the whole table for a name in chosen mode', () => {
    const s0 = chosenRound();
    const named = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(requiredJudges(named, IDS)).toEqual(['b', 'c']);
    expect(requiredJudges(named, IDS, ['c'])).toEqual(['b']);
  });

  // Only the target knows the clause being guessed at, so nobody else COULD
  // rule and asking anyone else to would leak it.
  it('is the target alone for a declaration in chosen mode', () => {
    const s0 = chosenRound();
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses', 'c'));
    expect(requiredJudges(declared, IDS)).toEqual(['c']);
    expect(requiredJudges(declared, IDS, ['c'])).toEqual([]);
  });

  it('is empty with nothing pending', () => {
    expect(requiredJudges(startRound(IDS), IDS)).toEqual([]);
    expect(requiredJudges(null, IDS)).toEqual([]);
  });
});

describe('proposing a name', () => {
  it('parks in the pending slot rather than joining the trail', () => {
    const s0 = startRound(IDS);
    const s = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(s.phase).toBe('judging');
    expect(s.pending).toEqual({ kind: 'proposal', text: 'Nezuko', verdicts: {} });
    // Not yet information — nobody has answered it.
    expect(trailFor(s, 'a')).toEqual([]);
    expect(proposalsUsed(s, 'a')).toBe(0);
  });

  it('cleans the text the way every other typed field is cleaned', () => {
    const s0 = startRound(IDS);
    expect(apply(s0, proposeName(s0, 'a', '  Edward   Elric ')).pending.text)
      .toBe('Edward Elric');
    expect(apply(s0, proposeName(s0, 'a', 'x'.repeat(200))).pending.text.length)
      .toBe(MAX_PROPOSAL_LEN);
  });

  it('refuses from anyone but the hot seat', () => {
    const s0 = startRound(IDS);
    expect(proposeName(s0, 'b', 'Nezuko').patch).toEqual({});
  });

  it('refuses a second name while one is pending, and refuses empty', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(proposeName(s1, 'a', 'Mikasa').patch).toEqual({});
    expect(proposeName(s0, 'a', '   ').patch).toEqual({});
  });

  it('refuses once the cap is spent', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(proposalsLeft(s, 'a')).toBe(0);
    expect(proposeName({ ...s, phase: 'naming' }, 'a', 'one more').patch).toEqual({});
  });

  // Nothing can be named until every clause exists to be named against.
  it('refuses while a chosen round is still picking', () => {
    const s = startRound(IDS, { mode: 'chosen' });
    expect(proposeName(s, 'a', 'Nezuko').patch).toEqual({});
    expect(declareCategory(s, 'a', 'wears glasses', 'b').patch).toEqual({});
  });
});

describe('judging a name', () => {
  it('records a yes and a no identically, because both are information', () => {
    const s0 = startRound(IDS);
    const pending = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    const yes = ruleAll(pending, true);
    expect(trailFor(yes, 'a')).toEqual([{ text: 'Nezuko', verdicts: { b: true } }]);
    const no = withNames(s0, 1);
    expect(trailFor(no, 'a')).toEqual([{ text: 'name 0', verdicts: { b: false } }]);
    expect(proposalsUsed(no, 'a')).toBe(1);
  });

  it('returns to naming with names still left', () => {
    const s = withLaps(startRound(IDS, { cap: 5 }), 2);
    expect(s.phase).toBe('naming');
    expect(s.pending).toBeNull();
    expect(proposalsLeft(s, 'a')).toBe(3);
  });

  // THE ONE-LINE STATEMENT OF THE WHOLE ROTATION. A settled name is not the end
  // of anything except that player's go.
  it('hands the seat to the next player on every settled name', () => {
    let s = startRound(IDS, { cap: 10 });
    const seats = [];
    for (let i = 0; i < 4; i++) {
      seats.push(s.seatId);
      s = withNames(s, 1);
    }
    // Wraps, and comes back round rather than parking on whoever opened.
    expect(seats).toEqual(['a', 'b', 'c', 'a']);
    // Four names spread as 2/1/1 rather than banked against whoever opened.
    expect(proposalsUsed(s, 'a')).toBe(2);
    expect(proposalsUsed(s, 'b')).toBe(1);
    expect(proposalsUsed(s, 'c')).toBe(1);
  });

  // A round that ran out still has to write a result, because `results` is what
  // seatFrom reads as "has finished".
  it('ends the player’s round — with a result — on their last name', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(s.phase).toBe('turnEnd');
    expect(s.results.a).toEqual({ solved: false, guess: '', used: MIN_CAP });
    // …and only theirs. Everyone else is still playing.
    expect(s.results.b).toBeUndefined();
  });

  // The tail of a round: once everybody else has finished, there is nobody to
  // hand the go to, so the last player simply keeps naming.
  it('keeps the seat on the last player still in the round', () => {
    const done = { solved: false, guess: '', used: 0 };
    const s0 = {
      ...startRound(IDS, { cap: 10 }), seatId: 'c', results: { a: done, b: done },
    };
    const s1 = withNames(s0, 2);
    expect(s1.seatId).toBe('c');
    expect(proposalsUsed(s1, 'c')).toBe(2);
  });

  it('ignores a verdict when nothing is pending', () => {
    expect(judge(startRound(IDS), 'b', true, ['b']).patch).toEqual({});
    expect(judge({ phase: 'judging', pending: null, seatId: 'a' }, 'b', true, ['b']).patch)
      .toEqual({});
  });

  it('refuses a judge who was not asked, and one who already answered', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    // 'c' is not the derived judge this turn.
    expect(judge(s1, 'c', true, ['b']).patch).toEqual({});
    const s2 = apply(chosenRound(), proposeName(chosenRound(), 'a', 'Nezuko'));
    const once = apply(s2, judge(s2, 'b', true, ['b', 'c']));
    expect(judge(once, 'b', false, ['b', 'c']).patch).toEqual({});
  });

  it('treats any non-true verdict as a no rather than as a crash', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    expect(apply(s1, judge(s1, 'b', undefined, ['b'])).trails.a[0].verdicts.b).toBe(false);
  });
});

// The half of the game the two-player example is about: everyone answers every
// name, each against their own clause.
describe('a name in chosen mode', () => {
  it('waits for every player before it becomes information', () => {
    const s0 = chosenRound({ cap: 5 });
    const named = apply(s0, proposeName(s0, 'a', 'Naruto'));
    const half = apply(named, judge(named, 'b', false, ['b', 'c']));
    // Still pending: one answer is not the answer.
    expect(half.phase).toBe('judging');
    expect(trailFor(half, 'a')).toEqual([]);
    expect(proposalsUsed(half, 'a')).toBe(0);

    const done = apply(half, judge(half, 'c', true, ['b', 'c']));
    expect(done.phase).toBe('naming');
    expect(trailFor(done, 'a')).toEqual([
      { text: 'Naruto', verdicts: { b: false, c: true } },
    ]);
  });

  // The whole point of attributing them: which player said no IS the fact.
  it('keeps every answer against the player who gave it', () => {
    const s = withNames(chosenRound({ cap: 5 }), 1, true);
    expect(verdictsOf(trailFor(s, 'a')[0])).toEqual([
      { judgeId: 'b', verdict: true },
      { judgeId: 'c', verdict: true },
    ]);
  });

  // The required set SHRINKS when somebody leaves, so a pending that could not
  // settle a minute ago settles now with no new verdict at all. Nothing else
  // notices, because the device that owed the answer is gone.
  it('settles on the strength of who is left when a judge departs', () => {
    const s0 = chosenRound({ cap: 5 });
    const named = apply(s0, proposeName(s0, 'a', 'Naruto'));
    const half = apply(named, judge(named, 'b', true, ['b', 'c']));
    expect(settlePending(half, requiredJudges(half, IDS)).patch).toEqual({});

    const settled = apply(half, settlePending(half, requiredJudges(half, IDS, ['c'])));
    expect(settled.phase).toBe('naming');
    expect(trailFor(settled, 'a')).toEqual([{ text: 'Naruto', verdicts: { b: true } }]);
  });

  // Nobody left who could answer: the name is unanswerable and recording a
  // verdict nobody gave would be inventing one.
  it('ends the turn when nobody is left to answer at all', () => {
    const s0 = chosenRound({ cap: 5 });
    const named = apply(s0, proposeName(s0, 'a', 'Naruto'));
    const done = apply(named, settlePending(named, []));
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: false, guess: '', used: 0 });
  });
});

describe('picking your own category', () => {
  it('records THAT a player picked and never what', () => {
    const s0 = startRound(IDS, { mode: 'chosen' });
    const s1 = apply(s0, recordPick(s0, 'a'));
    expect(hasPicked(s1, 'a')).toBe(true);
    expect(JSON.stringify(s1)).not.toMatch(/categor|glasses/i);
    // Idempotent, so a double tap or a replayed write costs nothing.
    expect(recordPick(s1, 'a').patch).toEqual({});
  });

  // The active roster, so a closed tab cannot hold the table on the opening
  // screen forever.
  it('opens the first turn once everyone STILL HERE has picked', () => {
    let s = startRound(IDS, { mode: 'chosen' });
    s = apply(s, recordPick(s, 'a'));
    s = apply(s, recordPick(s, 'b'));
    expect(everyonePicked(s, IDS)).toBe(false);
    expect(beginNaming(s, IDS).patch).toEqual({});
    expect(everyonePicked(s, ['a', 'b'])).toBe(true);
    expect(apply(s, beginNaming(s, ['a', 'b'])).phase).toBe('naming');
  });

  it('is never vacuously ready with an empty table', () => {
    expect(everyonePicked(startRound(IDS, { mode: 'chosen' }), [])).toBe(false);
  });

  // The seat is chosen before anybody has picked, so a seat who leaves during
  // the pick still has to be replaced — without opening a turn early.
  it('replaces a departed seat without leaving the picking phase', () => {
    const s0 = startRound(IDS, { mode: 'chosen' });
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a']));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('picking');
  });
});

describe('declaring the category', () => {
  it('goes through the same pending slot, because it needs the same human', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, declareCategory(s0, 'a', 'wears glasses'));
    expect(s1.phase).toBe('judging');
    expect(s1.pending).toEqual({ kind: 'declaration', text: 'wears glasses', verdicts: {} });
  });

  it('ends the declarer’s round when the judge says yes', () => {
    const s = withLaps(startRound(IDS, { cap: 10 }), 3);
    expect(s.seatId).toBe('a');
    const declared = apply(s, declareCategory(s, 'a', 'wears glasses'));
    const done = ruleAll(declared, true);
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: true, guess: 'wears glasses', used: 3 });
  });

  // The whole point of the softened rule: a miss used to end the round, which
  // was fine when a turn was an uninterrupted block and is a spectator sport now
  // that the seat moves every name.
  it('costs names rather than the round when the judge says no', () => {
    const s0 = startRound(IDS, { cap: 10 });
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    const done = ruleAll(s1, false);
    expect(done.phase).toBe('naming');
    expect(done.results.a).toBeUndefined();
    expect(proposalsUsed(done, 'a')).toBe(WRONG_DECLARATION_COST);
    // …and it still hands the go on, exactly as a name does.
    expect(done.seatId).toBe('b');
  });

  // The floor under the softened rule. Without it a player one name from the
  // cap could guess for free, which is the strategy the old whole-turn cost
  // existed to price.
  it('ends the round when the miss is what spends the cap', () => {
    const s0 = startRound(IDS, { cap: MIN_CAP });
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    const done = ruleAll(s1, false);
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: false, guess: 'is blond', used: MIN_CAP });
    expect(finalScores(done, IDS).a).toBe(0);
  });

  // A miss is stored in the trail, which is what makes it cost anything at all
  // and what stops the same guess being aimed at the same person twice.
  it('records the miss in the trail, with who it was aimed at', () => {
    const s0 = chosenRound({ cap: 10 });
    const done = ruleAll(apply(s0, declareCategory(s0, 'a', 'is blond', 'c')), false);
    expect(trailFor(done, 'a')).toEqual([
      { text: 'is blond', kind: 'declaration', targetId: 'c', verdicts: { c: false } },
    ]);
    expect(declaredTargets(done, 'a')).toEqual(['c']);
  });

  it('allows a blind declaration with no names spent', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, declareCategory(s0, 'a', 'is blond'));
    expect(ruleAll(s1, true).results.a.used).toBe(0);
  });

  it('refuses from anyone but the hot seat, and refuses empty', () => {
    const s0 = startRound(IDS);
    expect(declareCategory(s0, 'b', 'wears glasses').patch).toEqual({});
    expect(declareCategory(s0, 'a', '  ').patch).toEqual({});
  });

  it('carries whose rule it is claiming in chosen mode', () => {
    const s0 = chosenRound();
    const s1 = apply(s0, declareCategory(s0, 'a', 'wears glasses', 'c'));
    expect(s1.pending).toEqual({
      kind: 'declaration', text: 'wears glasses', targetId: 'c', verdicts: {},
    });
    const done = ruleAll(s1, true);
    expect(done.results.a).toEqual({
      solved: true, guess: 'wears glasses', used: 0, targetId: 'c',
    });
  });

  it('refuses a chosen declaration aimed at nobody, or at yourself', () => {
    const s0 = chosenRound();
    expect(declareCategory(s0, 'a', 'wears glasses').patch).toEqual({});
    expect(declareCategory(s0, 'a', 'wears glasses', 'a').patch).toEqual({});
  });
});

// scoreTurn pays a solve with zero names spent the MAXIMUM, so once a clause is
// out in the open a later player could re-declare it for free and outscore
// whoever actually worked it out. This is what stops that.
describe('first claim wins', () => {
  const claimed = () => {
    const s0 = chosenRound({ cap: 10 });
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses', 'c'));
    const done = ruleAll(declared, true);
    return apply(done, nextTurn(done, IDS));
  };

  it('records a correct declaration as a claim on that player', () => {
    const s = claimed();
    expect(claimedTargets(s)).toEqual(['c']);
    expect(s.seatId).toBe('b');
    expect(declarableIds(s, IDS)).toEqual(['a']);
  });

  it('refuses a second declaration at a player already claimed', () => {
    const s = claimed();
    expect(declareCategory(s, 'b', 'wears glasses', 'c').patch).toEqual({});
    // …and the one still standing is fine.
    expect(declareCategory(s, 'b', 'is a villain', 'a').patch).not.toEqual({});
  });

  // Guessing at somebody and missing must not lock them away from the players
  // who could have got them. This is the half that makes the claim rule fair,
  // and the softened miss makes it matter more rather than less: a missed
  // player is still worth full marks to everybody else.
  it('claims nobody on a wrong declaration', () => {
    const s0 = chosenRound({ cap: 10 });
    const declared = apply(s0, declareCategory(s0, 'a', 'is blond', 'c'));
    const done = ruleAll(declared, false);
    expect(claimedTargets(done)).toEqual([]);
    // The seat has moved on, and the new seat's options are untouched by
    // somebody else's miss.
    expect(done.seatId).toBe('b');
    expect(declarableIds(done, IDS)).toEqual(['a', 'c']);
  });

  // The mirror of first-claim-wins, and deliberately NOT the same shape: a
  // claim is global, a miss is personal. Only the player who spent the names is
  // barred, because the people who did not are owed the chance.
  it('bars only the misser from the person they missed at', () => {
    const s0 = chosenRound({ cap: 10 });
    let s = ruleAll(apply(s0, declareCategory(s0, 'a', 'is blond', 'c')), false);
    // 'b' and 'c' take a go each so the seat comes back round to 'a'.
    s = withNames(s, 2);
    expect(s.seatId).toBe('a');
    expect(declarableIds(s, IDS)).toEqual(['b']);
    expect(declareCategory(s, 'a', 'another guess', 'c').patch).toEqual({});
    expect(declareCategory(s, 'a', 'another guess', 'b').patch).not.toEqual({});
  });

  // Which means the list can empty out for a reason that has nothing to do with
  // anybody being solved — the screen has to say so either way.
  it('can leave a seat with nobody left to aim at after missing everyone', () => {
    let s = chosenRound({ cap: 20 });
    for (const at of ['b', 'c']) {
      s = ruleAll(apply(s, declareCategory(s, 'a', 'a guess', at)), false);
      s = withNames(s, 2);
    }
    expect(s.seatId).toBe('a');
    expect(claimedTargets(s)).toEqual([]);
    expect(declarableIds(s, IDS)).toEqual([]);
  });

  it('can legitimately leave the last seat with nobody to claim', () => {
    let s = chosenRound({ cap: 10 });
    // The two earlier seats claim EACH OTHER, which is the only arrangement at
    // three players that empties the last seat's list — a and b are its whole
    // target set. This is why the declare screen has to say so rather than
    // render a control that cannot do anything.
    for (const [by, at] of [['a', 'b'], ['b', 'a']]) {
      const d = apply(s, declareCategory(s, by, 'a clause', at));
      s = ruleAll(d, true);
      s = apply(s, nextTurn(s, IDS));
    }
    expect(s.seatId).toBe('c');
    expect(declarableIds(s, IDS)).toEqual([]);
  });

  it('has no claims at all in dealt mode, where a declaration has no target', () => {
    const s0 = startRound(IDS);
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses'));
    const done = ruleAll(declared, true);
    expect(claimedTargets(done)).toEqual([]);
    expect(declarableIds(done, IDS)).toEqual([]);
  });
});

// The other half of first-claim-wins: a clause that is still worth points must
// not be shown, and revealing one early is the same hole from the other side.
describe('revealing a chosen clause', () => {
  it('refuses while the clause is still worth claiming', () => {
    const s = chosenRound({ cap: 10 });
    expect(revealAllowed(s, 'c')).toBe(false);
    expect(publishCategory(s, 'c', 'glasses').patch).toEqual({});
  });

  it('allows it the moment its owner is claimed', () => {
    const s0 = chosenRound({ cap: 10 });
    const declared = apply(s0, declareCategory(s0, 'a', 'wears glasses', 'c'));
    const done = ruleAll(declared, true);
    expect(revealAllowed(done, 'c')).toBe(true);
    expect(revealAllowed(done, 'b')).toBe(false);
    expect(apply(done, publishCategory(done, 'c', 'glasses')).reveal).toEqual({ c: 'glasses' });
  });

  it('lets everything still standing out at the round end', () => {
    const s = { ...chosenRound(), phase: 'roundEnd' };
    expect(revealAllowed(s, 'b')).toBe(true);
    expect(apply(s, publishCategory(s, 'b', 'glasses')).reveal).toEqual({ b: 'glasses' });
  });

  it('is idempotent and refuses to overwrite', () => {
    const s = { ...chosenRound(), phase: 'roundEnd', reveal: { b: 'glasses' } };
    expect(publishCategory(s, 'b', 'villain').patch).toEqual({});
    expect(publishCategory(s, 'b', null).patch).toEqual({});
  });
});

describe('passing', () => {
  it('ends the turn unsolved, from the hot seat only', () => {
    const s0 = withLaps(startRound(IDS), 2);
    expect(passTurn(s0, 'b').patch).toEqual({});
    const done = apply(s0, passTurn(s0, 'a'));
    expect(done.phase).toBe('turnEnd');
    expect(done.results.a).toEqual({ solved: false, guess: '', used: 2 });
  });

  it('works while a ruling is pending, so a stuck judge cannot trap the seat', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, proposeName(s0, 'a', 'Nezuko'));
    const done = apply(s1, passTurn(s1, 'a'));
    expect(done.phase).toBe('turnEnd');
    expect(done.pending).toBeNull();
  });
});

// nextTurn is now the RARE half of the rotation: the seat moves on every name
// inside settlePending, and this only picks it up after somebody has finished.
describe('picking the rotation up after somebody finishes', () => {
  it('moves to the next player who has not finished', () => {
    const s0 = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    const s1 = apply(s0, nextTurn(s0, IDS));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('naming');
  });

  it('ends the round when everyone has finished', () => {
    let s = startRound(IDS, { cap: MIN_CAP });
    for (let i = 0; i < IDS.length; i++) {
      s = withNames(s, MIN_CAP * IDS.length);
      s = apply(s, nextTurn(s, IDS));
    }
    expect(s.phase).toBe('roundEnd');
    expect(roundComplete(s, IDS)).toBe(true);
  });

  it('steps over a player who left rather than offering them the seat', () => {
    const s0 = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(apply(s0, nextTurn(s0, IDS, ['b'])).seatId).toBe('c');
  });

  it('only fires at a turn end', () => {
    expect(nextTurn(startRound(IDS), IDS).patch).toEqual({});
  });

  // Counts the active roster, not results.length: a player who left mid-round
  // will never finish and would hold the round open forever.
  it('is complete once everyone STILL HERE has finished', () => {
    const s = withLaps(startRound(IDS, { cap: MIN_CAP }), MIN_CAP);
    expect(roundComplete(s, IDS)).toBe(false);
    expect(roundComplete(s, ['a'])).toBe(true);
  });
});

// What a screen draws the rotation from. Derived, so it cannot fall out of step
// with the round it describes.
describe('turnOrder', () => {
  it('is roster order, which IS seat order', () => {
    const s = withNames(startRound(IDS, { cap: 5 }), 1);
    expect(turnOrder(s, IDS).map((r) => r.playerId)).toEqual(IDS);
    expect(turnOrder(s, IDS).find((r) => r.isSeat).playerId).toBe('b');
    expect(turnOrder(s, IDS)[0]).toMatchObject({ used: 1, left: 4, done: false });
  });

  it('separates a player who solved from one who merely finished', () => {
    let s = chosenRound({ cap: 10 });
    s = ruleAll(apply(s, declareCategory(s, 'a', 'wears glasses', 'c')), true);
    s = apply(s, nextTurn(s, IDS));
    const rows = Object.fromEntries(turnOrder(s, IDS, ['c']).map((r) => [r.playerId, r]));
    expect(rows.a).toMatchObject({ done: true, solved: true });
    expect(rows.b).toMatchObject({ done: false, solved: false, isSeat: true });
    expect(rows.c).toMatchObject({ done: false, away: true });
  });
});

describe('skipDepartedSeat', () => {
  it('records the abandoned turn and moves on', () => {
    const s0 = withLaps(startRound(IDS), 2);
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a']));
    expect(s1.seatId).toBe('b');
    expect(s1.phase).toBe('naming');
    // Recorded rather than skipped, so a flicker of presence cannot hand them
    // the seat a second time.
    expect(s1.results.a).toEqual({ solved: false, guess: '', used: 2 });
  });

  it('ends the round when the departure was the last seat left', () => {
    const s0 = startRound(IDS);
    const s1 = apply(s0, skipDepartedSeat(s0, IDS, ['a', 'b', 'c']));
    expect(s1.phase).toBe('roundEnd');
  });

  it('does nothing when the hot seat is still here', () => {
    const s0 = startRound(IDS);
    expect(skipDepartedSeat(s0, IDS, ['b']).patch).toEqual({});
    expect(skipDepartedSeat(s0, IDS, []).patch).toEqual({});
  });

  // A departed JUDGE is judgeIdFor's problem in dealt mode and settlePending's
  // in chosen mode. Neither is this function's.
  it('does not fire for a departed judge', () => {
    const s0 = startRound(IDS);
    expect(skipDepartedSeat(s0, IDS, ['b']).patch).toEqual({});
    expect(judgeIdFor(s0, IDS, ['b'])).toBe('c');
  });
});

describe('scoreTurn', () => {
  it('pays nothing for an unsolved turn', () => {
    expect(scoreTurn({ solved: false, used: 1, cap: 10 })).toBe(0);
    expect(scoreTurn({})).toBe(0);
  });

  it('pays more the fewer names were spent', () => {
    const scores = [0, 1, 2, 3, 4].map((used) => scoreTurn({ solved: true, used, cap: 10 }));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i], `used ${i}`).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  // The ceiling: a lucky blind declaration must not outscore somebody who
  // actually worked the trail, so 0 and 1 names pay the same. It is also what
  // makes first-claim-wins load-bearing rather than decorative.
  it('caps a blind solve at what a one-name solve pays', () => {
    expect(scoreTurn({ solved: true, used: 0, cap: 10 })).toBe(10);
    expect(scoreTurn({ solved: true, used: 1, cap: 10 })).toBe(10);
    expect(scoreTurn({ solved: true, used: 2, cap: 10 })).toBe(9);
  });

  // The floor: solving on the last name still beat not solving at all.
  it('never pays a solve less than an unsolved turn', () => {
    expect(scoreTurn({ solved: true, used: 10, cap: 10 })).toBeGreaterThan(0);
    expect(scoreTurn({ solved: true, used: 99, cap: 10 })).toBeGreaterThan(0);
  });
});

describe('the round result', () => {
  it('scores only players who had a turn', () => {
    const s = { cap: 10, results: { a: { solved: true, used: 2 }, b: { solved: false, used: 10 } } };
    expect(finalScores(s, IDS)).toEqual({ a: 9, b: 0 });
  });

  // Both score zero; drawing them the same way would accuse somebody whose tab
  // closed of playing badly.
  it('separates a missed turn from a turn nobody got', () => {
    const s = { cap: 10, trails: {}, results: { a: { solved: false, guess: '', used: 4 } } };
    const [first, second] = explainRound(s, ['a', 'b']);
    expect(first.took).toBe(true);
    expect(first.solved).toBe(false);
    expect(second.took).toBe(false);
    expect(second.points).toBe(0);
  });

  it('carries each player their own category, handed in by the caller', () => {
    const s = { cap: 10, trails: {}, results: { a: { solved: true, used: 1 } } };
    const [row] = explainRound(s, ['a'], { a: 'glasses' });
    expect(row.category).toBe('glasses');
  });

  // The published value has to win, because it is the only source that works on
  // EVERY device: in each mode exactly one device is denied the clause.
  it('prefers a published clause to whatever this device happens to hold', () => {
    const s = { cap: 10, trails: {}, reveal: { a: 'villain' }, results: {} };
    expect(explainRound(s, ['a'], { a: 'glasses' })[0].category).toBe('villain');
  });

  // Showing only who you declared cannot say that somebody got YOU, which is
  // half of what a chosen round was about.
  it('reports both who a player went after and who claimed them', () => {
    const s = {
      cap: 10,
      trails: {},
      results: { a: { solved: true, used: 1, targetId: 'c' }, b: { solved: false, used: 3 } },
    };
    const [rowA, rowB, rowC] = explainRound(s, IDS);
    expect(rowA.targetId).toBe('c');
    expect(rowA.claimedBy).toBeNull();
    expect(rowB.targetId).toBeNull();
    expect(rowC.claimedBy).toBe('a');
  });

  it('adds a round onto the running totals', () => {
    expect(applyRoundScores({ a: 5 }, { a: 3, b: 2 })).toEqual({ a: 8, b: 2 });
    expect(applyRoundScores({ a: 5 }, null)).toEqual({ a: 5 });
  });
});

describe('verdictsOf', () => {
  // Three stored shapes have to read as one, or every screen branches.
  it('flattens a map, a map of one, and a pre-attribution scalar', () => {
    expect(verdictsOf({ text: 'x', verdicts: { b: true, c: false } })).toEqual([
      { judgeId: 'b', verdict: true },
      { judgeId: 'c', verdict: false },
    ]);
    expect(verdictsOf({ text: 'x', verdicts: { b: false } }))
      .toEqual([{ judgeId: 'b', verdict: false }]);
    expect(verdictsOf({ text: 'x', verdict: true }))
      .toEqual([{ judgeId: null, verdict: true }]);
    expect(verdictsOf({ text: 'x' })).toEqual([]);
    expect(verdictsOf(null)).toEqual([]);
  });
});

describe('normalizers', () => {
  // RTDB drops null elements, so a partly-stored trail comes back sparse and a
  // mostly-empty one comes back keyed by index. Array.map SKIPS HOLES, which is
  // why this uses a plain loop.
  it('reads a trail back from all three shapes RTDB serves', () => {
    const dense = [{ text: 'x', verdicts: { b: true } }, { text: 'y', verdicts: { b: false } }];
    expect(normalizeTrail(dense)).toEqual(dense);

    const sparse = [];
    sparse[0] = dense[0];
    sparse[3] = dense[1];
    expect(normalizeTrail(sparse)).toEqual(dense);

    expect(normalizeTrail({ 0: dense[0], 3: { text: 'y' } }))
      .toEqual([dense[0], { text: 'y', verdicts: {} }]);

    expect(normalizeTrail(undefined)).toEqual([]);
  });

  // A room mid-round across a deploy: the previous build stored one
  // unattributed boolean per name, and dropping it would show ten names nobody
  // appears to have answered.
  it('carries a pre-attribution verdict through untouched', () => {
    expect(normalizeTrail([{ text: 'x', verdict: true }]))
      .toEqual([{ text: 'x', verdicts: {}, verdict: true }]);
  });

  // A miss weighs WRONG_DECLARATION_COST names and bars a target, and both
  // facts live on the entry — so an entry that came back as a plain name would
  // silently refund the penalty and unlock the person it was aimed at.
  it('carries a miss’s kind and target back off the wire', () => {
    expect(normalizeTrail([
      { text: 'is blond', kind: 'declaration', targetId: 'c', verdicts: { c: false } },
      { text: 'Nezuko', verdicts: { b: true } },
    ])).toEqual([
      { text: 'is blond', kind: 'declaration', targetId: 'c', verdicts: { c: false } },
      { text: 'Nezuko', verdicts: { b: true } },
    ]);
    // …and a kind it has never heard of is simply not one.
    expect(normalizeTrail([{ text: 'x', kind: 'nonsense', verdicts: {} }]))
      .toEqual([{ text: 'x', verdicts: {} }]);
  });

  it('never invents a trail entry, which would count against the cap', () => {
    expect(normalizeTrail([null, { text: '' }, 'nonsense', { verdicts: { b: true } }]))
      .toEqual([]);
  });

  // CLAUDE.md's "rebuilding a keyed collection from the ACTIVE roster deletes
  // departed players' data" trap. These normalizers keep every key found and
  // invent none, so it cannot bite.
  it('keeps a departed player’s trail and result through a rewrite', () => {
    const trails = normalizeTrails({ gone: [{ text: 'x', verdicts: { b: true } }] });
    expect(trails.gone).toHaveLength(1);
    const results = normalizeResults({ gone: { solved: true, guess: 'g', used: 2 } });
    expect(results.gone).toEqual({ solved: true, guess: 'g', used: 2 });
  });

  // Dropping a targetId would quietly unlock a player somebody already won.
  it('keeps the claim on a result', () => {
    expect(normalizeResults({ a: { solved: true, guess: 'g', used: 1, targetId: 'c' } }).a)
      .toEqual({ solved: true, guess: 'g', used: 1, targetId: 'c' });
    expect(normalizeResults({ a: { solved: true, used: 1, targetId: 42 } }).a.targetId)
      .toBeUndefined();
  });

  it('repairs a result missing every field rather than dropping it', () => {
    expect(normalizeResults({ a: {} }).a).toEqual({ solved: false, guess: '', used: 0 });
    expect(normalizeResults({ a: null })).toEqual({});
  });

  it('drops a pending ruling that cannot be acted on', () => {
    expect(normalizePending({ kind: 'proposal', text: 'x' }))
      .toEqual({ kind: 'proposal', text: 'x', verdicts: {} });
    expect(normalizePending({ kind: 'declaration', text: 'x', targetId: 'c', verdicts: { c: true } }))
      .toEqual({ kind: 'declaration', text: 'x', targetId: 'c', verdicts: { c: true } });
    expect(normalizePending({ kind: 'nonsense', text: 'x' })).toBeNull();
    expect(normalizePending({ kind: 'proposal', text: '' })).toBeNull();
    expect(normalizePending(undefined)).toBeNull();
  });

  // Rebuilt from named fields, so a stray key from an older build cannot ride
  // in — and a field the hook writes but this forgets is silently dropped.
  it('rebuilds the round from named fields only', () => {
    const g = normalizeGame({ round: 2, cap: 7, seatId: 'a', phase: 'naming', stray: 'nope' });
    expect(g.stray).toBeUndefined();
    expect(g).toEqual({
      round: 2, cap: 7, mode: 'dealt', seatId: 'a', phase: 'naming',
      pending: null, picked: {}, trails: {}, results: {}, reveal: {}, lastPlayed: null,
    });
  });

  // The opposite of the pref's default, on purpose: the only round that can
  // reach here without a mode is one already in flight from the build before
  // this field existed, and that round is a dealt one by definition.
  it('reads a round written before modes existed as a dealt one', () => {
    expect(normalizeGame({ round: 0, seatId: 'a' }).mode).toBe('dealt');
    expect(normalizeGame({ round: 0, seatId: 'a', mode: 'nonsense' }).mode).toBe('dealt');
    expect(normalizeGame({ round: 0, seatId: 'a', mode: 'chosen' }).mode).toBe('chosen');
  });

  it('survives everything RTDB drops on the way back', () => {
    const g = normalizeGame({ round: 0, seatId: 'a' });
    expect(g.trails).toEqual({});
    expect(g.results).toEqual({});
    expect(g.picked).toEqual({});
    expect(g.reveal).toEqual({});
    expect(g.pending).toBeNull();
    expect(g.cap).toBe(DEFAULT_CAP);
    expect(g.phase).toBe('naming');
    expect(normalizeGame(null)).toBeNull();
  });

  it('round-trips a real mid-turn round through JSON, which is the online path', () => {
    let s = startRound(IDS, { cap: 6 });
    s = withNames(s, 2);
    s = apply(s, proposeName(s, s.seatId, 'Nezuko'));
    expect(normalizeGame(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('round-trips a chosen round carrying picks, a claim and a reveal', () => {
    let s = chosenRound({ cap: 6 });
    s = withLaps(s, 1, true);
    const declared = apply(s, declareCategory(s, 'a', 'wears glasses', 'c'));
    s = ruleAll(declared, true);
    s = apply(s, publishCategory(s, 'c', { id: 'x', label: 'Wears glasses', custom: true }));
    expect(normalizeGame(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});
