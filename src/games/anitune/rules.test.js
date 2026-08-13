import { describe, it, expect } from 'vitest';
import {
  RACE, SIMULTANEOUS, LIVES, startRound, buzz, resolveBuzz, everyoneLockedOut, releaseBuzz,
  submitAnswer, beginEntry, startGuessing, submitOnlineAnswer, revealNow, giveUp, nextQuestion,
  openWindow, scoreAnswer, expireQuestion, livePlayerIds, answerElapsedMs, resumeRound,
} from './rules';

const player = (id) => ({ id, name: id });
const ANA = player('ana');
const BEN = player('ben');
const CLEO = player('cleo');
const ALL = [ANA, BEN, CLEO];
const ALL_IDS = ['ana', 'ben', 'cleo'];

// isCorrectTitleGuess matches on the question's titles, so a wrong guess is
// anything that shares no words with them.
const QUESTION = { id: 'q1', animeTitle: 'Cowboy Bebop', displayTitle: 'Cowboy Bebop' };
const RIGHT = 'Cowboy Bebop';
const WRONG = 'Naruto';

// An arbitrary "clip started here" instant. Nothing reads a real clock, so any
// number does — which is the point of the `now` parameter convention.
const T0 = 1_000_000;
const TIMED = { timed: true, guessSeconds: 20, answerSeconds: 10 };

const roundWith = (overrides) => ({ ...startRound(ALL, RACE), ...overrides });

// A timed round with its window already open, as a live one always is.
function timedRound(mode = SIMULTANEOUS, options = {}) {
  const base = startRound(ALL, mode, { ...TIMED, ...options });
  return { ...base, ...openWindow(base, T0).patch };
}

describe('everyoneLockedOut', () => {
  it('ignores locked-out ids that are no longer on the roster', () => {
    // The departed player is still named in lockedOut; the two who remain are
    // both out, so the question is finished even though 2 < 3.
    expect(everyoneLockedOut([ANA, BEN], ['ana', 'ben', 'cleo'])).toBe(true);
  });

  it('is false while anyone on the roster can still buzz', () => {
    expect(everyoneLockedOut(ALL, ['ana', 'ben'])).toBe(false);
    expect(everyoneLockedOut([ANA], [])).toBe(false);
  });

  it('is false for an empty roster rather than declaring a phantom finish', () => {
    expect(everyoneLockedOut([], [])).toBe(false);
  });
});

describe('resolveBuzz', () => {
  it('scores the buzzer and reveals on a correct guess', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana' });
    const { patch } = resolveBuzz(state, QUESTION, RIGHT, ALL, T0);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores.ana).toBe(1);
    expect(patch.answers.ana).toMatchObject({ text: RIGHT, correct: true });
  });

  it('locks a wrong buzzer out and hands the clip back to the rest', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana' });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, ALL, T0);
    expect(patch.phase).toBe('listening');
    expect(patch.buzzedBy).toBe(null);
    expect(patch.lockedOut).toEqual(['ana']);
  });

  it('reveals once everyone still in the room is locked out', () => {
    // Cleo left mid-round, so the online caller passes the two who remain. The
    // old count-based check compared 2 locked-out against 3 players and stalled.
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ben', lockedOut: ['ana'] });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, [ANA, BEN], T0);
    expect(patch.phase).toBe('revealed');
  });

  it('keeps listening when a departed player is the only one left unlocked', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana', lockedOut: [] });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, ALL, T0);
    expect(patch.phase).toBe('listening');
  });

  it('is a no-op outside the buzzed phase', () => {
    expect(resolveBuzz(roundWith({ phase: 'listening' }), QUESTION, RIGHT, ALL, T0).patch).toEqual({});
    expect(resolveBuzz(roundWith({ phase: 'buzzed', buzzedBy: null }), QUESTION, RIGHT, ALL, T0).patch)
      .toEqual({});
  });
});

describe('releaseBuzz', () => {
  it('hands the question back and locks out the player who vanished', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana' });
    const { patch } = releaseBuzz(state, 'ana', T0);
    expect(patch).toMatchObject({ phase: 'listening', buzzedBy: null, lockedOut: ['ana'] });
  });

  it('does not double-add a player already locked out', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana', lockedOut: ['ana'] });
    expect(releaseBuzz(state, 'ana', T0).patch.lockedOut).toEqual(['ana']);
  });

  it('refuses to release a buzz that is not the named player’s', () => {
    // Two devices could both notice the departure; the guard keeps the second
    // one from clearing a buzz that someone else has since claimed.
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ben' });
    expect(releaseBuzz(state, 'ana', T0).patch).toEqual({});
  });

  it('is a no-op once the question has moved on', () => {
    expect(releaseBuzz(roundWith({ phase: 'listening', buzzedBy: null }), 'ana', T0).patch).toEqual({});
    expect(releaseBuzz(roundWith({ phase: 'revealed', buzzedBy: 'ana' }), 'ana', T0).patch).toEqual({});
  });
});

describe('submitOnlineAnswer', () => {
  const base = () => startRound(ALL, SIMULTANEOUS);

  it('holds the reveal until every id it was given has answered', () => {
    const first = submitOnlineAnswer(base(), QUESTION, 'ana', RIGHT, ['ana', 'ben'], T0);
    expect(first.patch.phase).toBeUndefined();
    expect(first.patch.answers.ana.correct).toBe(true);
  });

  it('reveals on the last answer from the active roster, ignoring who left', () => {
    // Cleo is gone, so the caller passes two ids — waiting on all three would
    // hold the reveal open forever.
    const withAna = { ...base(), ...submitOnlineAnswer(base(), QUESTION, 'ana', RIGHT, ['ana', 'ben'], T0).patch };
    const { patch } = submitOnlineAnswer(withAna, QUESTION, 'ben', WRONG, ['ana', 'ben'], T0);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores).toEqual({ ana: 1, ben: 0, cleo: 0 });
  });

  it('ignores a second submission from the same player', () => {
    const withAna = { ...base(), ...submitOnlineAnswer(base(), QUESTION, 'ana', WRONG, ['ana', 'ben'], T0).patch };
    expect(submitOnlineAnswer(withAna, QUESTION, 'ana', RIGHT, ['ana', 'ben'], T0).patch).toEqual({});
  });
});

describe('revealNow', () => {
  it('scores only the answers that made it in', () => {
    const state = {
      ...startRound(ALL, SIMULTANEOUS),
      answers: { ana: { text: RIGHT, correct: true }, ben: { text: WRONG, correct: false } },
    };
    const { patch } = revealNow(state);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores).toEqual({ ana: 1, ben: 0, cleo: 0 });
  });

  it('is a no-op once revealed, so a second device cannot double-score', () => {
    const state = {
      ...startRound(ALL, SIMULTANEOUS),
      phase: 'revealed',
      answers: { ana: { text: RIGHT, correct: true } },
    };
    expect(revealNow(state).patch).toEqual({});
  });
});

describe('advancement', () => {
  it('parks at the end of the round rather than running past it', () => {
    expect(nextQuestion({ ...startRound(ALL, RACE), index: 4 }, ALL, 5).finished).toBe(true);
    expect(nextQuestion({ ...startRound(ALL, RACE), index: 3 }, ALL, 5).finished).toBe(false);
  });

  it('clears the per-question state on the way to the next clip', () => {
    const state = roundWith({ index: 0, phase: 'revealed', buzzedBy: 'ana', lockedOut: ['ana'] });
    const { patch } = nextQuestion(state, ALL, 5);
    expect(patch).toMatchObject({ index: 1, phase: 'listening', buzzedBy: null, lockedOut: [], answers: {} });
  });

  it('clears the clock so the next question cannot inherit a dead deadline', () => {
    const state = { ...timedRound(RACE), phase: 'revealed' };
    const { patch } = nextQuestion(state, ALL, 5);
    expect(patch.windowStartAt).toBeNull();
    expect(patch.deadlineAt).toBeNull();
    expect(patch.windowMs).toBeNull();
  });

  it('lets any device concede a question, but only once', () => {
    expect(giveUp(roundWith({ phase: 'listening' })).patch.phase).toBe('revealed');
    expect(giveUp(roundWith({ phase: 'revealed' })).patch).toEqual({});
  });
});

// --- The clock -------------------------------------------------------------

describe('openWindow', () => {
  it('opens at the clip start, not at the deal', () => {
    const state = startRound(ALL, SIMULTANEOUS, TIMED);
    expect(state.windowStartAt).toBeNull();
    const { patch } = openWindow(state, T0);
    expect(patch).toEqual({ windowStartAt: T0, windowMs: 20000, deadlineAt: T0 + 20000 });
  });

  // Every device calls it; only the first can win, and the losers must not move
  // a window that answers are already being scored against.
  it('is idempotent once open', () => {
    expect(openWindow(timedRound(), T0 + 5000).patch).toEqual({});
  });

  it('does nothing at all in an untimed round', () => {
    expect(openWindow(startRound(ALL, SIMULTANEOUS), T0).patch).toEqual({});
  });
});

describe('scoreAnswer', () => {
  it('pays nothing for a wrong or missing answer', () => {
    expect(scoreAnswer({ correct: false, ms: 0 }, 20000)).toBe(0);
    expect(scoreAnswer(undefined, 20000)).toBe(0);
  });

  // The property that keeps this a recognition game: the bonus tops out at 1,
  // so no amount of speed makes a wrong answer worth anything.
  it('always pays at least the base point for a correct one', () => {
    expect(scoreAnswer({ correct: true, ms: 19999 }, 20000)).toBeGreaterThanOrEqual(1);
    expect(scoreAnswer({ correct: true, ms: 0 }, 20000)).toBe(2);
  });

  it('scales between the two', () => {
    expect(scoreAnswer({ correct: true, ms: 2100 }, 20000)).toBeCloseTo(1.895, 3);
    expect(scoreAnswer({ correct: true, ms: 14000 }, 20000)).toBeCloseTo(1.3, 3);
  });

  // An untimed round must pay exactly what it paid before the clock existed,
  // or turning the setting off would silently change the game.
  it('falls back to a flat point with no window', () => {
    expect(scoreAnswer({ correct: true, ms: 0 }, null)).toBe(1);
    expect(scoreAnswer({ correct: true, ms: null }, 20000)).toBe(1);
  });

  it('reports elapsed time for the reveal, null-safe', () => {
    expect(answerElapsedMs({ ms: 2100 })).toBe(2100);
    expect(answerElapsedMs({ ms: null })).toBeNull();
    expect(answerElapsedMs(undefined)).toBeNull();
  });
});

describe('speed scoring end to end', () => {
  it('pays the faster of two correct answers more', () => {
    const base = timedRound(SIMULTANEOUS);
    const withAna = { ...base, ...submitOnlineAnswer(base, QUESTION, 'ana', RIGHT, ALL_IDS, T0 + 2000).patch };
    const withBen = { ...withAna, ...submitOnlineAnswer(withAna, QUESTION, 'ben', RIGHT, ALL_IDS, T0 + 15000).patch };
    const { patch } = submitOnlineAnswer(withBen, QUESTION, 'cleo', WRONG, ALL_IDS, T0 + 16000);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores.ana).toBeCloseTo(1.9, 5);
    expect(patch.scores.ben).toBeCloseTo(1.25, 5);
    expect(patch.scores.cleo).toBe(0);
  });

  // You won the race at the buzzer; racing your own typing afterwards would be
  // a spelling contest.
  it('measures a race to the buzz, not to the submit', () => {
    const base = timedRound(RACE);
    const buzzed = { ...base, ...buzz(base, 'ana', T0 + 2000).patch };
    const { patch } = resolveBuzz(buzzed, QUESTION, RIGHT, ALL, T0 + 9000);
    expect(patch.scores.ana).toBeCloseTo(1.9, 5);
  });
});

describe('the race buzz window pauses', () => {
  it('holds the remaining buzz time while someone answers', () => {
    const base = timedRound(RACE);
    const { patch } = buzz(base, 'ana', T0 + 5000);
    expect(patch.pausedRemainingMs).toBe(15000);
    // Their own, shorter answer clock takes over.
    expect(patch.deadlineAt).toBe(T0 + 5000 + 10000);
  });

  it('hands the untouched remainder back on a wrong answer', () => {
    const base = timedRound(RACE);
    const buzzed = { ...base, ...buzz(base, 'ana', T0 + 5000).patch };
    const { patch } = resolveBuzz(buzzed, QUESTION, WRONG, ALL, T0 + 12000);
    // 15s were left when they buzzed; the 7s they spent typing cost the room
    // nothing, so the rest still have 15s from now.
    expect(patch.deadlineAt).toBe(T0 + 12000 + 15000);
    expect(patch.pausedRemainingMs).toBeNull();
  });

  it('gives the remainder back when the buzzer walks away, too', () => {
    const base = timedRound(RACE);
    const buzzed = { ...base, ...buzz(base, 'ana', T0 + 5000).patch };
    expect(releaseBuzz(buzzed, 'ana', T0 + 30000).patch.deadlineAt).toBe(T0 + 30000 + 15000);
  });

  it('leaves an untimed race with no clock to pause', () => {
    const base = startRound(ALL, RACE);
    const { patch } = buzz(base, 'ana', T0);
    expect(patch.deadlineAt).toBeNull();
    expect(patch.pausedRemainingMs).toBeNull();
  });
});

describe('expireQuestion', () => {
  it('marks everyone still owing an answer as passing, and scores once', () => {
    const base = timedRound(SIMULTANEOUS);
    const withAna = { ...base, ...submitOnlineAnswer(base, QUESTION, 'ana', RIGHT, ALL_IDS, T0 + 1000).patch };
    const { patch } = expireQuestion(withAna, QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.phase).toBe('revealed');
    expect(patch.answers.ben).toMatchObject({ text: '', correct: false });
    expect(patch.scores.ana).toBeCloseTo(1.95, 5);
    expect(patch.scores.ben).toBe(0);
  });

  // Several devices notice the expiry a few hundred ms apart and all fire.
  it('is idempotent, so a second device cannot double-score', () => {
    const base = timedRound(SIMULTANEOUS);
    const expired = { ...base, ...expireQuestion(base, QUESTION, ALL_IDS, T0 + 20000).patch };
    expect(expireQuestion(expired, QUESTION, ALL_IDS, T0 + 20100).patch).toEqual({});
  });

  it('never fires on an untimed round', () => {
    expect(expireQuestion(startRound(ALL, SIMULTANEOUS), QUESTION, ALL_IDS, T0).patch).toEqual({});
  });

  it('concedes an unbuzzed race', () => {
    const { patch } = expireQuestion(timedRound(RACE), QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.phase).toBe('revealed');
  });

  // The rest of the room can still win this clip, so a timed-out buzzer is a
  // wrong answer, not the end of the question.
  it('treats a timed-out buzzer as a wrong answer and resumes the race', () => {
    const base = timedRound(RACE);
    const buzzed = { ...base, ...buzz(base, 'ana', T0 + 3000).patch };
    const { patch } = expireQuestion(buzzed, QUESTION, ALL_IDS, T0 + 13000);
    expect(patch.phase).toBe('listening');
    expect(patch.lockedOut).toEqual(['ana']);
    expect(patch.deadlineAt).toBe(T0 + 13000 + 17000);
  });

  it('passes the device on when a local entry turn runs out', () => {
    const base = startRound(ALL, SIMULTANEOUS, TIMED);
    const handoff = { ...base, ...startGuessing(base).patch };
    const entry = { ...handoff, ...beginEntry(handoff, T0).patch };
    const { patch } = expireQuestion(entry, QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.phase).toBe('handoff');
    expect(patch.answers[entry.entryOrder[0]]).toMatchObject({ text: '', correct: false });
  });

  // A frozen or backgrounded tab runs the expiry effect only when it comes back,
  // so `now` can be far past the deadline. That is the recording being late, not
  // the player being slow — a stalled renderer once printed "43.0s" on a
  // six-second window.
  it('reports at most the window, however late the expiry actually fires', () => {
    const base = startRound(ALL, SIMULTANEOUS, TIMED);
    const handoff = { ...base, ...startGuessing(base).patch };
    const entry = { ...handoff, ...beginEntry(handoff, T0).patch };
    const { patch } = expireQuestion(entry, QUESTION, ALL_IDS, T0 + 43000);
    expect(patch.answers[entry.entryOrder[0]].ms).toBe(20000);
  });

  // The two expiry paths must describe the same event the same way: this branch
  // stamps windowMs directly, the pass-and-play one comes through elapsedIn.
  it('agrees with the pass-and-play path about an unanswered question', () => {
    const shared = expireQuestion(timedRound(SIMULTANEOUS), QUESTION, ALL_IDS, T0 + 99000);
    expect(shared.patch.answers.ana.ms).toBe(20000);
  });

  // The same clamp covers a real submit that loses the race with the expiry.
  it('does not let a submit landing after the deadline exceed the window', () => {
    const base = timedRound(SIMULTANEOUS);
    const { patch } = submitOnlineAnswer(base, QUESTION, 'ana', RIGHT, ALL_IDS, T0 + 20050);
    expect(patch.answers.ana.ms).toBe(20000);
    expect(scoreAnswer(patch.answers.ana, base.windowMs)).toBe(1);
  });

  it('leaves a handoff alone — nobody is holding the device yet', () => {
    const base = startRound(ALL, SIMULTANEOUS, TIMED);
    const handoff = { ...base, ...startGuessing(base).patch };
    expect(expireQuestion(handoff, QUESTION, ALL_IDS, T0 + 99999).patch).toEqual({});
  });
});

describe('pass-and-play windows are per player', () => {
  it('restarts the clock each time the device changes hands', () => {
    const base = startRound(ALL, SIMULTANEOUS, TIMED);
    const handoff = { ...base, ...startGuessing(base).patch };
    const first = { ...handoff, ...beginEntry(handoff, T0).patch };
    expect(first.windowStartAt).toBe(T0);

    const passed = { ...first, ...submitAnswer(first, QUESTION, RIGHT, T0 + 4000).patch };
    const second = { ...passed, ...beginEntry(passed, T0 + 30000).patch };
    // The fourth player has sat through three turns of thinking time; a shared
    // window would score that queue rather than them.
    expect(second.windowStartAt).toBe(T0 + 30000);
  });

  it('scores each player against their own window', () => {
    const base = startRound([ANA, BEN], SIMULTANEOUS, TIMED);
    const h1 = { ...base, ...startGuessing(base).patch };
    const e1 = { ...h1, ...beginEntry(h1, T0).patch };
    const p1 = { ...e1, ...submitAnswer(e1, QUESTION, RIGHT, T0 + 2000).patch };
    const e2 = { ...p1, ...beginEntry(p1, T0 + 60000).patch };
    const { patch } = submitAnswer(e2, QUESTION, RIGHT, T0 + 62000);
    // Both answered in two seconds of their own turn, so both score the same
    // despite being a minute apart on the wall clock.
    expect(patch.scores[e1.entryOrder[0]]).toBeCloseTo(1.9, 5);
    expect(patch.scores[e1.entryOrder[1]]).toBeCloseTo(1.9, 5);
  });
});

// --- Lives -----------------------------------------------------------------

describe('lives mode', () => {
  const livesRound = () => {
    const base = startRound(ALL, LIVES, { ...TIMED, startingLives: 2 });
    return { ...base, ...openWindow(base, T0).patch };
  };

  it('deals everyone the same lives', () => {
    expect(livesRound().lives).toEqual({ ana: 2, ben: 2, cleo: 2 });
  });

  it('costs a life for a wrong answer and none for a right one', () => {
    const base = livesRound();
    const a = { ...base, ...submitOnlineAnswer(base, QUESTION, 'ana', RIGHT, ALL_IDS, T0 + 1000).patch };
    const b = { ...a, ...submitOnlineAnswer(a, QUESTION, 'ben', WRONG, ALL_IDS, T0 + 1000).patch };
    const { patch } = submitOnlineAnswer(b, QUESTION, 'cleo', WRONG, ALL_IDS, T0 + 1000);
    expect(patch.lives).toEqual({ ana: 2, ben: 1, cleo: 1 });
    expect(patch.eliminated).toEqual([]);
  });

  // Waiting out the clock has to cost the same as guessing wrong, or silence is
  // the dominant strategy.
  it('costs a life for saying nothing at all', () => {
    const { patch } = expireQuestion(livesRound(), QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.lives).toEqual({ ana: 1, ben: 1, cleo: 1 });
  });

  it('eliminates at zero, in order', () => {
    const one = { ...livesRound(), lives: { ana: 1, ben: 1, cleo: 2 } };
    const { patch } = expireQuestion(one, QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.lives).toEqual({ ana: 0, ben: 0, cleo: 1 });
    expect(patch.eliminated).toEqual(['ana', 'ben']);
  });

  // The whole reason livePlayerIds exists: an eliminated player is present,
  // watching, and will never submit. Presence cannot see that.
  it('does not wait on an eliminated player', () => {
    const state = { ...livesRound(), eliminated: ['cleo'], lives: { ana: 2, ben: 2, cleo: 0 } };
    expect(livePlayerIds(state, ALL_IDS)).toEqual(['ana', 'ben']);

    const live = livePlayerIds(state, ALL_IDS);
    const a = { ...state, ...submitOnlineAnswer(state, QUESTION, 'ana', RIGHT, live, T0 + 1000).patch };
    const { patch } = submitOnlineAnswer(a, QUESTION, 'ben', RIGHT, live, T0 + 1000);
    expect(patch.phase).toBe('revealed');
  });

  it('never charges an already-eliminated player another life', () => {
    const state = { ...livesRound(), eliminated: ['cleo'], lives: { ana: 1, ben: 1, cleo: 0 } };
    const { patch } = expireQuestion(state, QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.lives.cleo).toBe(0);
    expect(patch.eliminated).toEqual(['cleo', 'ana', 'ben']);
  });

  it('ends the round once one player is left standing', () => {
    const state = { ...livesRound(), index: 0, eliminated: ['ben', 'cleo'] };
    expect(nextQuestion(state, ALL, 10).finished).toBe(true);
  });

  it('keeps going while two are alive', () => {
    const state = { ...livesRound(), index: 0, eliminated: ['cleo'] };
    expect(nextQuestion(state, ALL, 10).finished).toBe(false);
  });

  // Pass-and-play would otherwise hand the device to someone who is out, and
  // submitAnswer would charge them a life for a question they were never in.
  it('drops the eliminated from the next question’s pass order', () => {
    const state = { ...livesRound(), index: 0, eliminated: ['cleo'] };
    const { patch } = nextQuestion(state, ALL, 10);
    expect(patch.entryOrder.sort()).toEqual(['ana', 'ben']);
  });

  // A solo player should get to use their last life, not be finished the moment
  // they are the only one left — which they are from the start.
  it('runs a solo game until the last life is gone', () => {
    const solo = startRound([ANA], LIVES, { ...TIMED, startingLives: 2 });
    expect(nextQuestion({ ...solo, index: 0 }, [ANA], 10).finished).toBe(false);
    expect(nextQuestion({ ...solo, index: 0, eliminated: ['ana'] }, [ANA], 10).finished).toBe(true);
  });

  it('leaves other modes with no lives bookkeeping at all', () => {
    const base = timedRound(SIMULTANEOUS);
    const { patch } = expireQuestion(base, QUESTION, ALL_IDS, T0 + 20000);
    expect(patch.lives).toBeUndefined();
    expect(patch.eliminated).toBeUndefined();
  });

  // A departure reconciliation reaches for revealNow; leaving the room should
  // not also cost a life.
  it('charges nobody when revealNow is used to unwedge a departure', () => {
    const state = { ...livesRound(), answers: { ana: { text: RIGHT, correct: true, at: T0 } } };
    expect(revealNow(state).patch.lives).toEqual({ ana: 2, ben: 2, cleo: 2 });
  });
});

describe('resumeRound', () => {
  // The whole reason this exists: a deadline is an absolute instant, so one
  // written to storage last night has already passed. Resuming into it would
  // expire the question the moment it rendered.
  it('clears the expired clock and re-asks the question', () => {
    const saved = {
      ...startRound(ALL, SIMULTANEOUS, TIMED),
      index: 3,
      phase: 'entry',
      windowStartAt: T0,
      deadlineAt: T0 + 20_000,
      answers: { ana: { text: RIGHT, correct: true, ms: 900 } },
    };
    const back = resumeRound(saved, ALL, 10);
    expect(back.index).toBe(3);
    expect(back.phase).toBe('listening');
    expect(back.deadlineAt).toBeNull();
    expect(back.windowStartAt).toBeNull();
    expect(back.answers).toEqual({});
  });

  it('carries scores, lives and the elimination order across untouched', () => {
    const saved = {
      ...startRound(ALL, LIVES, { ...TIMED, startingLives: 3 }),
      index: 4,
      scores: { ana: 7, ben: 2, cleo: 0 },
      lives: { ana: 2, ben: 1, cleo: 0 },
      eliminated: ['cleo'],
    };
    const back = resumeRound(saved, ALL, 10);
    expect(back.scores).toEqual({ ana: 7, ben: 2, cleo: 0 });
    expect(back.lives).toEqual({ ana: 2, ben: 1, cleo: 0 });
    expect(back.eliminated).toEqual(['cleo']);
  });

  // Same rule nextQuestion applies: submitAnswer would charge an eliminated
  // player a life for a question they were never in.
  it('rebuilds the pass order from survivors only', () => {
    const saved = {
      ...startRound(ALL, LIVES, { startingLives: 3 }),
      index: 2,
      lives: { ana: 1, ben: 2, cleo: 0 },
      eliminated: ['cleo'],
    };
    expect(resumeRound(saved, ALL, 10).entryOrder).not.toContain('cleo');
  });

  it('keeps everyone in the order when the mode has no lives', () => {
    const saved = { ...startRound(ALL, SIMULTANEOUS), index: 1, eliminated: ['cleo'] };
    expect([...resumeRound(saved, ALL, 10).entryOrder].sort()).toEqual(ALL_IDS);
  });

  it('resumes the last question, and refuses one past the end', () => {
    const saved = { ...startRound(ALL, RACE), index: 9 };
    // Index 9 of ten IS the last question, so there is still a clip to play.
    expect(resumeRound(saved, ALL, 10)?.index).toBe(9);
    expect(resumeRound({ ...saved, index: 10 }, ALL, 10)).toBeNull();
    expect(resumeRound({ ...saved, index: -1 }, ALL, 10)).toBeNull();
  });

  it('refuses a Lives round with no contest left', () => {
    const saved = {
      ...startRound(ALL, LIVES, { startingLives: 1 }),
      index: 2,
      lives: { ana: 1, ben: 0, cleo: 0 },
      eliminated: ['ben', 'cleo'],
    };
    expect(resumeRound(saved, ALL, 10)).toBeNull();
  });

  // It reads a blob out of localStorage that an older build may have written,
  // so junk has to mean "offer a fresh game" rather than throw.
  it('refuses junk rather than throwing', () => {
    expect(resumeRound(null, ALL, 10)).toBeNull();
    expect(resumeRound(undefined, ALL, 10)).toBeNull();
    expect(resumeRound('nope', ALL, 10)).toBeNull();
    expect(resumeRound({}, ALL, 10)).toBeNull();
    expect(resumeRound({ index: 'two' }, ALL, 10)).toBeNull();
    expect(resumeRound({ ...startRound(ALL, RACE), index: 1 }, [], 10)).toBeNull();
  });

  it('resumes a solo Lives round while the player still has a life', () => {
    const solo = [ANA];
    const saved = { ...startRound(solo, LIVES, { startingLives: 3 }), index: 2, lives: { ana: 1 } };
    expect(resumeRound(saved, solo, 10)?.index).toBe(2);
  });
});
