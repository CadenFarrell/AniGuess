import { describe, it, expect } from 'vitest';
import { answerTrail } from './answerTrail';

const question = (id, answer) => ({ id, type: 'question', answer });
const guess = (id, correct) => ({ id, type: 'guess', correct });
const timer = (id) => ({ id, type: 'timer', text: "⏱️ Time's up!" });

describe('answerTrail', () => {
  it('reads oldest-first, the reverse of the stored log', () => {
    // rules.js prepends, so this is: Yes, then No, then Yes.
    const log = [question('c', 'Yes'), question('b', 'No'), question('a', 'Yes')];

    expect(answerTrail(log).map((chip) => chip.id)).toEqual(['a', 'b', 'c']);
    expect(answerTrail(log).map((chip) => chip.icon)).toEqual(['✅', '❌', '✅']);
  });

  it('does not reverse the caller in place', () => {
    const log = [question('b', 'Yes'), question('a', 'No')];
    answerTrail(log);

    expect(log.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('marks a wrong guess and an expired timer distinctly from a No', () => {
    const trail = answerTrail([timer('t'), guess('g', false), question('q', 'No')]);

    expect(trail.map((chip) => chip.tone)).toEqual(['no', 'no', 'warn']);
    expect(trail.map((chip) => chip.icon)).toEqual(['❌', '🎯❌', '⏱️']);
  });

  it('drops entries with no answer rather than guessing at one', () => {
    // A typed-mode entry always carries an answer; anything without one came
    // from a path that never asked the table, so it has no chip to render.
    const trail = answerTrail([{ id: 'x', type: 'question' }, question('q', 'Yes')]);

    expect(trail.map((chip) => chip.id)).toEqual(['q']);
  });

  it('survives an empty, missing or malformed log', () => {
    expect(answerTrail()).toEqual([]);
    expect(answerTrail([])).toEqual([]);
    expect(answerTrail(null)).toEqual([]);
    expect(answerTrail([null, { id: 'u', type: 'unknown' }])).toEqual([]);
  });
});
