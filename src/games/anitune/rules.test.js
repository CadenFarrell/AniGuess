import { describe, it, expect } from 'vitest';
import {
  RACE, SIMULTANEOUS, startRound, resolveBuzz, everyoneLockedOut, releaseBuzz,
  submitOnlineAnswer, revealNow, giveUp, nextQuestion,
} from './rules';

const player = (id) => ({ id, name: id });
const ANA = player('ana');
const BEN = player('ben');
const CLEO = player('cleo');
const ALL = [ANA, BEN, CLEO];

// isCorrectTitleGuess matches on the question's titles, so a wrong guess is
// anything that shares no words with them.
const QUESTION = { id: 'q1', animeTitle: 'Cowboy Bebop', displayTitle: 'Cowboy Bebop' };
const RIGHT = 'Cowboy Bebop';
const WRONG = 'Naruto';

const roundWith = (overrides) => ({ ...startRound(ALL, RACE), ...overrides });

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
    const { patch } = resolveBuzz(state, QUESTION, RIGHT, ALL);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores.ana).toBe(1);
    expect(patch.answers.ana).toEqual({ text: RIGHT, correct: true });
  });

  it('locks a wrong buzzer out and hands the clip back to the rest', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana' });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, ALL);
    expect(patch.phase).toBe('listening');
    expect(patch.buzzedBy).toBe(null);
    expect(patch.lockedOut).toEqual(['ana']);
  });

  it('reveals once everyone still in the room is locked out', () => {
    // Cleo left mid-round, so the online caller passes the two who remain. The
    // old count-based check compared 2 locked-out against 3 players and stalled.
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ben', lockedOut: ['ana'] });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, [ANA, BEN]);
    expect(patch.phase).toBe('revealed');
  });

  it('keeps listening when a departed player is the only one left unlocked', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana', lockedOut: [] });
    const { patch } = resolveBuzz(state, QUESTION, WRONG, ALL);
    expect(patch.phase).toBe('listening');
  });

  it('is a no-op outside the buzzed phase', () => {
    expect(resolveBuzz(roundWith({ phase: 'listening' }), QUESTION, RIGHT, ALL).patch).toEqual({});
    expect(resolveBuzz(roundWith({ phase: 'buzzed', buzzedBy: null }), QUESTION, RIGHT, ALL).patch)
      .toEqual({});
  });
});

describe('releaseBuzz', () => {
  it('hands the question back and locks out the player who vanished', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana' });
    const { patch } = releaseBuzz(state, 'ana');
    expect(patch).toEqual({ phase: 'listening', buzzedBy: null, lockedOut: ['ana'] });
  });

  it('does not double-add a player already locked out', () => {
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ana', lockedOut: ['ana'] });
    expect(releaseBuzz(state, 'ana').patch.lockedOut).toEqual(['ana']);
  });

  it('refuses to release a buzz that is not the named player’s', () => {
    // Two devices could both notice the departure; the guard keeps the second
    // one from clearing a buzz that someone else has since claimed.
    const state = roundWith({ phase: 'buzzed', buzzedBy: 'ben' });
    expect(releaseBuzz(state, 'ana').patch).toEqual({});
  });

  it('is a no-op once the question has moved on', () => {
    expect(releaseBuzz(roundWith({ phase: 'listening', buzzedBy: null }), 'ana').patch).toEqual({});
    expect(releaseBuzz(roundWith({ phase: 'revealed', buzzedBy: 'ana' }), 'ana').patch).toEqual({});
  });
});

describe('submitOnlineAnswer', () => {
  const base = () => startRound(ALL, SIMULTANEOUS);

  it('holds the reveal until every id it was given has answered', () => {
    const first = submitOnlineAnswer(base(), QUESTION, 'ana', RIGHT, ['ana', 'ben']);
    expect(first.patch.phase).toBeUndefined();
    expect(first.patch.answers.ana.correct).toBe(true);
  });

  it('reveals on the last answer from the active roster, ignoring who left', () => {
    // Cleo is gone, so the caller passes two ids — waiting on all three would
    // hold the reveal open forever.
    const withAna = { ...base(), ...submitOnlineAnswer(base(), QUESTION, 'ana', RIGHT, ['ana', 'ben']).patch };
    const { patch } = submitOnlineAnswer(withAna, QUESTION, 'ben', WRONG, ['ana', 'ben']);
    expect(patch.phase).toBe('revealed');
    expect(patch.scores).toEqual({ ana: 1, ben: 0, cleo: 0 });
  });

  it('ignores a second submission from the same player', () => {
    const withAna = { ...base(), ...submitOnlineAnswer(base(), QUESTION, 'ana', WRONG, ['ana', 'ben']).patch };
    expect(submitOnlineAnswer(withAna, QUESTION, 'ana', RIGHT, ['ana', 'ben']).patch).toEqual({});
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

  it('lets any device concede a question, but only once', () => {
    expect(giveUp(roundWith({ phase: 'listening' })).patch.phase).toBe('revealed');
    expect(giveUp(roundWith({ phase: 'revealed' })).patch).toEqual({});
  });
});
