import { describe, it, expect } from 'vitest';
import {
  CATEGORY_MODES, CATEGORY_POOLS, DEFAULT_PREFS, MAX_ROUNDS, MIN_ROUNDS,
  MODE_LABELS, POOL_LABELS,
} from './prefs';
import { DEFAULT_CAP, MAX_CAP, MIN_CAP, normalizeGame } from './rules';
import { CATEGORIES, poolSize } from './categories';
import { SETTING_HELP } from './help';

// AniTag's defaults carry one property that is not a preference at all, plus
// three screens reading values out of other modules. Both classes are one edit
// away from breaking silently, so both are pinned here.

describe('DEFAULT_PREFS', () => {
  // THE property. mergePrefs fills a missing key from the defaults on the next
  // read, so anything added here reaches every existing player — and anything
  // implying a card pool would quietly end the "playable with no import"
  // guarantee that is most of this game's reason to exist.
  it('names nothing that would require an AniList import', () => {
    for (const key of Object.keys(DEFAULT_PREFS)) {
      expect(key, key).not.toMatch(/shared|list|deck|fame|import/i);
    }
    expect(DEFAULT_PREFS).not.toHaveProperty('sharedOnly');
    expect(DEFAULT_PREFS).not.toHaveProperty('cardPool');
  });

  it('starts inside every bound the screens enforce', () => {
    expect(DEFAULT_PREFS.rounds).toBeGreaterThanOrEqual(MIN_ROUNDS);
    expect(DEFAULT_PREFS.rounds).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(DEFAULT_PREFS.proposalCap).toBeGreaterThanOrEqual(MIN_CAP);
    expect(DEFAULT_PREFS.proposalCap).toBeLessThanOrEqual(MAX_CAP);
    expect(DEFAULT_PREFS.proposalCap).toBe(DEFAULT_CAP);
  });

  it('defaults to a pool the registry can actually deal', () => {
    expect(CATEGORY_POOLS).toContain(DEFAULT_PREFS.categoryPool);
    expect(poolSize(DEFAULT_PREFS.categoryPool)).toBeGreaterThan(0);
  });

  // The default that MOVES EXISTING PLAYERS, which is the intent rather than a
  // side effect: mergePrefs fills a missing key from this literal on the next
  // read. rules.js's own fallback is deliberately the other one — see toMode
  // there — so this pins which is which.
  it('defaults to a mode rules.js knows, and to the chosen one', () => {
    expect(CATEGORY_MODES).toContain(DEFAULT_PREFS.categoryMode);
    expect(DEFAULT_PREFS.categoryMode).toBe('chosen');
    expect(normalizeGame({ round: 0 }).mode).toBe('dealt');
  });

  // DEFAULT_PREFS is the schema mergePrefs type-checks against, so a value of
  // the wrong type here would silently drop the saved one on every read.
  it('is flat, with only types mergePrefs can validate', () => {
    for (const [key, value] of Object.entries(DEFAULT_PREFS)) {
      expect(['string', 'number', 'boolean'], key).toContain(typeof value);
    }
  });
});

describe('the screens agree with the modules they read from', () => {
  it('labels every pool it offers, and offers every pool it labels', () => {
    expect(Object.keys(POOL_LABELS).sort()).toEqual([...CATEGORY_POOLS].sort());
    for (const pool of CATEGORY_POOLS) {
      expect(POOL_LABELS[pool].label, pool).toBeTruthy();
      expect(POOL_LABELS[pool].noun, pool).toBeTruthy();
      expect(POOL_LABELS[pool].plural, pool).toBeTruthy();
    }
  });

  it('labels every mode it offers, and offers every mode it labels', () => {
    expect(Object.keys(MODE_LABELS).sort()).toEqual([...CATEGORY_MODES].sort());
    for (const mode of CATEGORY_MODES) {
      expect(MODE_LABELS[mode].label, mode).toBeTruthy();
      expect(MODE_LABELS[mode].blurb, mode).toBeTruthy();
    }
  });

  it('ships built-in categories for every pool a session can pick', () => {
    for (const pool of CATEGORY_POOLS) {
      expect(poolSize(pool), pool).toBeGreaterThan(0);
    }
    // And every built-in sits in a pool a session can actually choose, or it
    // would ship as content nothing ever deals.
    for (const c of CATEGORIES) {
      expect([...CATEGORY_POOLS, 'both'], c.id).toContain(c.pool);
    }
  });

  it('writes help for every remembered option', () => {
    for (const key of Object.keys(DEFAULT_PREFS)) {
      expect(SETTING_HELP[key], key).toBeTruthy();
      expect(SETTING_HELP[key].short, key).toBeTruthy();
    }
  });
});
