import { describe, it, expect } from 'vitest';
import { FAME_LEVELS, DEFAULT_FAME_ID, getFame } from './fame';

describe('getFame', () => {
  it('never returns undefined, whatever id it is handed', () => {
    // Same contract as modes.js's getMode, for the same reason: an id can arrive
    // from a saved room or a saved prefs blob written by an older build, and a
    // setup screen that cannot name its own setting renders a blank control.
    expect(getFame('iconic').id).toBe('iconic');
    expect(getFame('no-such-level').id).toBe(DEFAULT_FAME_ID);
    expect(getFame(undefined).id).toBe(DEFAULT_FAME_ID);
    expect(getFame(null).id).toBe(DEFAULT_FAME_ID);
    expect(getFame(42).id).toBe(DEFAULT_FAME_ID);
  });
});

describe('FAME_LEVELS', () => {
  it('carries a quantile that is either off or a real fraction', () => {
    // null is the off switch and is NOT interchangeable with 0 — see the note in
    // fame.js. A stray 0 would quietly make "Anyone" a filter that prefers any
    // character with a favourites count over any character without one.
    for (const level of FAME_LEVELS) {
      if (level.quantile === null) continue;
      expect(level.quantile).toBeGreaterThan(0);
      expect(level.quantile).toBeLessThan(1);
    }
    expect(FAME_LEVELS.find((f) => f.id === 'any').quantile).toBeNull();
  });

  it('has a default that is one of the levels', () => {
    expect(FAME_LEVELS.some((f) => f.id === DEFAULT_FAME_ID)).toBe(true);
  });
});
