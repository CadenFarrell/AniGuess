import { describe, it, expect } from 'vitest';
import { shuffle } from './random';

// A counter-based rng, so a expectation below reads as a fixed permutation
// rather than "whatever Math.random did". Fisher-Yates walks i from the end
// down to 1 and swaps with j = floor(rng() * (i + 1)).
const seq = (...values) => {
  let i = 0;
  return () => values[i++];
};

describe('shuffle', () => {
  it('does not mutate the input', () => {
    const items = ['a', 'b', 'c'];
    const out = shuffle(items, seq(0, 0));
    expect(items).toEqual(['a', 'b', 'c']);
    expect(out).not.toBe(items);
  });

  it('keeps every element exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(items);
    expect(out).toHaveLength(items.length);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  // The property three games actually depend on: two devices handed the same
  // seeded rng deal the same order. Without it a room's players disagree about
  // what was dealt, which is unfalsifiable from any one screen.
  it('is deterministic for a given rng sequence', () => {
    const items = ['a', 'b', 'c', 'd'];
    const draws = [0.7, 0.1, 0.9];
    expect(shuffle(items, seq(...draws))).toEqual(shuffle(items, seq(...draws)));
  });

  it('produces the permutation Fisher-Yates specifies', () => {
    // i=3: j = floor(0 * 4) = 0 -> swap 0,3 => d b c a
    // i=2: j = floor(0 * 3) = 0 -> swap 0,2 => c b d a
    // i=1: j = floor(0 * 2) = 0 -> swap 0,1 => b c d a
    expect(shuffle(['a', 'b', 'c', 'd'], seq(0, 0, 0))).toEqual(['b', 'c', 'd', 'a']);
  });

  it('leaves every element in place when each draw picks itself', () => {
    // rng just under 1 makes j === i on every step, so nothing moves.
    const items = ['a', 'b', 'c', 'd'];
    expect(shuffle(items, () => 0.999999)).toEqual(items);
  });

  it('handles empty and single-element lists', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['only'])).toEqual(['only']);
  });
});
