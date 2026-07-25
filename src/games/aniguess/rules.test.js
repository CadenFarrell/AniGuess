import { describe, it, expect } from 'vitest';
import {
  getNextPlayerIndex, firstActiveIndex, roundComplete, revealDone,
  skipDepartedAssignment, skipDepartedTurn, turnComplete, correctGuess, wrongGuess, newRound,
} from './rules';

const player = (id) => ({ id, name: id });
const PLAYERS = [player('ana'), player('ben'), player('cleo'), player('dev')];
const lock = (id, turnsUsed = 1, position = 1) => ({ playerId: id, name: id, position, points: 3, turnsUsed });

const stateWith = (overrides = {}) => ({
  gameSession: { players: PLAYERS, settings: { pointsPerPosition: [3, 2, 1, 0] } },
  assignmentIndex: 0,
  currentPlayerIndex: 0,
  lockedPositions: [],
  questionLogs: {},
  turnCounts: {},
  roundNumber: 1,
  totalScores: {},
  ...overrides,
});

const entry = (type = 'question') => ({ id: 'log1', type, text: 'is she tall?' });

describe('getNextPlayerIndex', () => {
  it('steps over players who have left as well as those already locked', () => {
    // ben left, cleo is already placed — so the turn after ana goes to dev.
    expect(getNextPlayerIndex(PLAYERS, 0, [lock('cleo')], ['ben'])).toBe(3);
  });

  it('is unchanged when no skip list is given, so local play is unaffected', () => {
    expect(getNextPlayerIndex(PLAYERS, 0, [])).toBe(1);
    expect(getNextPlayerIndex(PLAYERS, 3, [])).toBe(0); // wraparound
  });

  it('wraps back to the player who is still going', () => {
    expect(getNextPlayerIndex(PLAYERS, 2, [lock('dev')], ['ben', 'cleo'])).toBe(0);
  });

  it('returns -1 when nobody is left to take a turn', () => {
    expect(getNextPlayerIndex(PLAYERS, 0, [lock('ana')], ['ben', 'cleo', 'dev'])).toBe(-1);
  });
});

describe('firstActiveIndex', () => {
  it('skips leading departed players so the opening turn goes to someone real', () => {
    expect(firstActiveIndex(PLAYERS, ['ana', 'ben'])).toBe(2);
    expect(firstActiveIndex(PLAYERS, [])).toBe(0);
  });

  it('falls back to 0 rather than -1 when everyone has gone', () => {
    expect(firstActiveIndex(PLAYERS, ['ana', 'ben', 'cleo', 'dev'])).toBe(0);
  });
});

describe('roundComplete', () => {
  it('ends the round once everyone still here has been placed', () => {
    // cleo and dev left; ana and ben are both locked, so nothing is outstanding.
    const locked = [lock('ana'), lock('ben')];
    expect(roundComplete(locked, [PLAYERS[0], PLAYERS[1]])).toBe(true);
  });

  it('keeps the round open while an active player is unplaced', () => {
    expect(roundComplete([lock('ana')], [PLAYERS[0], PLAYERS[1]])).toBe(false);
  });

  it('does not declare an empty room complete', () => {
    expect(roundComplete([], [])).toBe(false);
  });
});

describe('revealDone', () => {
  it('moves to the next assignee normally', () => {
    const { patch, next } = revealDone(stateWith({ assignmentIndex: 0 }));
    expect(next).toBe('assignment');
    expect(patch.assignmentIndex).toBe(1);
  });

  it('skips over assignees who have left', () => {
    const { patch, next } = revealDone(stateWith({ assignmentIndex: 0 }), ['ben', 'cleo']);
    expect(next).toBe('assignment');
    expect(patch.assignmentIndex).toBe(3);
  });

  it('starts the game on the first player still here, not blindly on index 0', () => {
    const { patch, next } = revealDone(stateWith({ assignmentIndex: 3 }), ['ana']);
    expect(next).toBe('game');
    expect(patch.currentPlayerIndex).toBe(1);
  });
});

describe('skipDepartedAssignment', () => {
  it('does nothing while the assignee is still here', () => {
    expect(skipDepartedAssignment(stateWith({ assignmentIndex: 1 }), ['dev']).next).toBe(null);
  });

  it('jumps to the next assignee who is still here', () => {
    const { patch, next } = skipDepartedAssignment(stateWith({ assignmentIndex: 1 }), ['ben', 'cleo']);
    expect(next).toBe('assignment');
    expect(patch.assignmentIndex).toBe(3);
  });

  it('drops into the game when nobody is left to assign', () => {
    const { patch, next } = skipDepartedAssignment(stateWith({ assignmentIndex: 2 }), ['cleo', 'dev']);
    expect(next).toBe('game');
    expect(patch.currentPlayerIndex).toBe(0);
  });
});

describe('skipDepartedTurn', () => {
  it('does nothing while the guesser is still here', () => {
    expect(skipDepartedTurn(stateWith({ currentPlayerIndex: 0 }), ['ben']).patch).toEqual({});
  });

  it('passes the turn on and drops whatever they left hanging', () => {
    const { patch } = skipDepartedTurn(stateWith({ currentPlayerIndex: 1 }), ['ben']);
    expect(patch.currentPlayerIndex).toBe(2);
    expect(patch.turnState).toEqual({ pendingAction: null });
  });

  it('leaves the turn alone when there is nobody to pass it to', () => {
    // ana is locked, everyone but the departed ben is gone — no valid successor.
    const state = stateWith({ currentPlayerIndex: 1, lockedPositions: [lock('ana')] });
    expect(skipDepartedTurn(state, ['ben', 'cleo', 'dev']).patch).toEqual({});
  });
});

describe('turn advancement with departures', () => {
  it('turnComplete hands the next turn to someone who can actually take it', () => {
    const { patch } = turnComplete(stateWith({ currentPlayerIndex: 0 }), entry(), ['ben']);
    expect(patch.currentPlayerIndex).toBe(2);
    expect(patch.turnCounts.ana).toBe(1);
  });

  it('turnComplete leaves the index alone when everyone else has gone', () => {
    const state = stateWith({ currentPlayerIndex: 0, lockedPositions: [lock('ana')] });
    const { patch } = turnComplete(state, entry(), ['ben', 'cleo', 'dev']);
    expect(patch.currentPlayerIndex).toBeUndefined();
    expect(patch.turnCounts.ana).toBe(1);
  });

  it('wrongGuess skips departed players too', () => {
    const { patch } = wrongGuess(stateWith({ currentPlayerIndex: 0 }), entry('guess'), ['ben', 'cleo']);
    expect(patch.currentPlayerIndex).toBe(3);
  });

  it('correctGuess locks the winner and skips departed players for the next turn', () => {
    const { patch } = correctGuess(stateWith({ currentPlayerIndex: 0 }), entry('guess'), ['ben']);
    expect(patch.lockedPositions).toHaveLength(1);
    expect(patch.lockedPositions[0].playerId).toBe('ana');
    expect(patch.currentPlayerIndex).toBe(2);
  });

  it('correctGuess omits the index when that was the last player standing', () => {
    const state = stateWith({ currentPlayerIndex: 0 });
    const { patch } = correctGuess(state, entry('guess'), ['ben', 'cleo', 'dev']);
    expect(patch.currentPlayerIndex).toBeUndefined();
  });
});

describe('newRound', () => {
  it('opens the next round on a player who is still here', () => {
    const { patch, next } = newRound(stateWith({ roundNumber: 2 }), ['ana', 'ben']);
    expect(next).toBe('assignment');
    expect(patch.assignmentIndex).toBe(2);
    expect(patch.currentPlayerIndex).toBe(2);
    expect(patch.roundNumber).toBe(3);
  });

  it('still starts at zero for local play', () => {
    const { patch } = newRound(stateWith({ roundNumber: 1 }));
    expect(patch.assignmentIndex).toBe(0);
    expect(patch.currentPlayerIndex).toBe(0);
  });
});
