import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, DEFAULT_CATEGORY_ID, MAX_LABEL_LEN,
  categoryIdOf, categoryInPool, categoryLabel, customCategory, dealCategories,
  getCategory, isCustom, normalizeCustomCategory, poolSize, suggestionsFor,
} from './categories';

// A stand-in for Math.random that walks a fixed list, so a draw is reproducible
// without stubbing globals. Values are consumed in order and wrap.
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('the category registry', () => {
  it('gives every category the fields a judge screen reads off it', () => {
    for (const c of CATEGORIES) {
      expect(c.id, `${c.id} id`).toBeTruthy();
      expect(c.label, `${c.id} label`).toBeTruthy();
      expect(['shows', 'characters', 'both'], `${c.id} pool`).toContain(c.pool);
    }
  });

  it('keeps ids unique, so getCategory cannot resolve two different clauses', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every label inside what the editor will accept', () => {
    for (const c of CATEGORIES) {
      expect(c.label.length, `${c.id} label`).toBeLessThanOrEqual(MAX_LABEL_LEN);
    }
  });

  // Two players must never hold one clause (see dealCategories), so a pool
  // thinner than a plausible table starts repeating immediately. Not a hard
  // requirement of the code — it refills deliberately — but a thin pool is a
  // content bug this catches before a table does.
  it('offers enough of each pool for a normal table', () => {
    expect(poolSize('shows')).toBeGreaterThanOrEqual(8);
    expect(poolSize('characters')).toBeGreaterThanOrEqual(8);
  });

  it('counts player-written categories into whichever pool is asked for', () => {
    const mine = normalizeCustomCategory({ label: 'Has a hat' });
    expect(poolSize('shows', [mine])).toBe(poolSize('shows') + 1);
    expect(poolSize('characters', [mine])).toBe(poolSize('characters') + 1);
  });
});

describe('getCategory', () => {
  it('resolves a built-in id', () => {
    expect(getCategory(CATEGORIES[0].id)).toEqual(CATEGORIES[0]);
  });

  it('resolves an already-resolved category and a bare id wrapper', () => {
    expect(getCategory(CATEGORIES[1])).toEqual(CATEGORIES[1]);
    expect(getCategory({ id: CATEGORIES[1].id })).toEqual(CATEGORIES[1]);
  });

  it('never returns undefined, however broken the spec', () => {
    for (const spec of [null, undefined, '', {}, [], 42, 'no-such-id']) {
      expect(getCategory(spec), JSON.stringify(spec)).toBeTruthy();
      expect(getCategory(spec).label).toBeTruthy();
    }
    expect(getCategory('no-such-id').id).toBe(DEFAULT_CATEGORY_ID);
  });

  // THE regression this file exists for. A stored custom carries an id that
  // resolves to nothing, so a resolver checking `spec.id` before `spec.custom`
  // hands back DEFAULT_CATEGORY_ID — and the judge then rules yes/no against a
  // clause its author never wrote, on every device, silently.
  it('checks custom BEFORE id, so a written category is never played as a built-in', () => {
    const mine = normalizeCustomCategory({ label: 'Has a distinctive hat' });
    expect(mine.id.startsWith('custom_')).toBe(true);
    const resolved = getCategory(mine);
    expect(resolved.label).toBe('Has a distinctive hat');
    expect(resolved.id).toBe(mine.id);
    expect(isCustom(resolved)).toBe(true);
  });

  // A written category travels as its whole definition inside assignments/,
  // which means it goes through JSON. This round trip IS the online path.
  it('survives the JSON round trip a room write puts it through', () => {
    const mine = normalizeCustomCategory({ label: 'Would win in a fight' });
    const throughRtdb = JSON.parse(JSON.stringify(mine));
    expect(getCategory(throughRtdb).label).toBe('Would win in a fight');
    expect(categoryLabel(throughRtdb)).toBe('Would win in a fight');
  });
});

describe('normalizeCustomCategory', () => {
  it('trims, collapses runs of whitespace and truncates', () => {
    const c = normalizeCustomCategory({ label: '  wears   a\that  ' });
    expect(c.label).toBe('wears a hat');
    expect(normalizeCustomCategory({ label: 'x'.repeat(200) }).label.length)
      .toBe(MAX_LABEL_LEN);
  });

  it('does NOT uppercase — a category is a sentence, not an end cap', () => {
    expect(normalizeCustomCategory({ label: 'Wears a hat' }).label).toBe('Wears a hat');
  });

  it('returns null when there is nothing worth storing', () => {
    for (const label of ['', '   ', null, undefined]) {
      expect(normalizeCustomCategory({ label }), JSON.stringify(label)).toBeNull();
    }
    expect(normalizeCustomCategory(null)).toBeNull();
  });

  // What makes the editor's save an update rather than a duplicate.
  it('keeps an existing id', () => {
    const first = normalizeCustomCategory({ label: 'Has a hat' });
    const edited = normalizeCustomCategory({ id: first.id, label: 'Has two hats' });
    expect(edited.id).toBe(first.id);
  });

  it('stays one string and one boolean, so RTDB stores all of it', () => {
    const c = normalizeCustomCategory({ label: 'Has a hat' });
    expect(Object.keys(c).sort()).toEqual(['custom', 'id', 'label']);
    for (const v of Object.values(c)) {
      expect(['string', 'boolean']).toContain(typeof v);
    }
  });

  it('customCategory falls back to a built-in rather than returning null', () => {
    expect(customCategory({ label: '' }).id).toBe(DEFAULT_CATEGORY_ID);
  });
});

describe('categoryInPool', () => {
  it('passes everything when no pool is named', () => {
    expect(categoryInPool({ pool: 'shows' }, null)).toBe(true);
  });

  it('never filters a player-written category, which carries no pool', () => {
    const mine = normalizeCustomCategory({ label: 'Has a hat' });
    expect(categoryInPool(mine, 'shows')).toBe(true);
    expect(categoryInPool(mine, 'characters')).toBe(true);
  });

  it('filters a built-in to its own pool', () => {
    expect(categoryInPool({ pool: 'shows' }, 'characters')).toBe(false);
    expect(categoryInPool({ pool: 'both' }, 'characters')).toBe(true);
  });
});

describe('dealCategories', () => {
  it('gives every player a category', () => {
    const dealt = dealCategories(['a', 'b', 'c'], seq(0.1, 0.5, 0.9));
    expect(Object.keys(dealt).sort()).toEqual(['a', 'b', 'c']);
  });

  // The requirement the whole function exists for: two players sharing a clause
  // means the table answers both the same way, and the second is playing a game
  // whose answer is already on screen.
  it('never deals one clause to two players while the pool can cover them', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const dealt = dealCategories(ids, seq(0.3, 0.7, 0.1, 0.95, 0.5, 0.2, 0.8, 0.4));
    const specs = Object.values(dealt).map((s) => categoryIdOf(s));
    expect(new Set(specs).size).toBe(ids.length);
  });

  // Refills rather than returning short: a player with no category has no turn.
  it('refills instead of running out when there are more players than clauses', () => {
    const ids = Array.from({ length: poolSize('shows') + 3 }, (_, i) => `p${i}`);
    const dealt = dealCategories(ids, seq(0.5), { pool: 'shows' });
    expect(Object.keys(dealt)).toHaveLength(ids.length);
    for (const id of ids) expect(dealt[id], id).toBeTruthy();
  });

  it('draws only from the requested pool', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const dealt = dealCategories(ids, seq(0.1, 0.4, 0.6, 0.9), { pool: 'characters' });
    for (const spec of Object.values(dealt)) {
      expect(getCategory(spec).pool).toBe('characters');
    }
  });

  it('keeps last round out of this one', () => {
    const excluded = CATEGORIES.filter((c) => c.pool === 'shows').slice(0, 4);
    const dealt = dealCategories(['a'], seq(0), { pool: 'shows', exclude: excluded });
    expect(excluded.map((c) => c.id)).not.toContain(categoryIdOf(dealt.a));
  });

  // Excluding everything must not deal nothing.
  it('falls back to the whole pool when excluding would empty it', () => {
    const shows = CATEGORIES.filter((c) => c.pool === 'shows');
    const dealt = dealCategories(['a'], seq(0), { pool: 'shows', exclude: shows });
    expect(dealt.a).toBeTruthy();
  });

  // Built-ins ship on every device so an id suffices; a written one has been
  // seen by exactly one device, so the definition has to travel.
  it('returns a built-in as its id and a custom as its whole definition', () => {
    const mine = normalizeCustomCategory({ label: 'Has a hat' });
    const dealt = dealCategories(['a', 'b'], seq(0.99, 0), { pool: 'shows', extra: [mine] });
    for (const spec of Object.values(dealt)) {
      if (typeof spec === 'string') expect(getCategory(spec).custom).toBeUndefined();
      else expect(spec.custom).toBe(true);
    }
  });

  it('deals nothing for an empty table rather than throwing', () => {
    expect(dealCategories([], seq(0.5))).toEqual({});
  });
});

// CHOSEN MODE's half of the same eligible list dealCategories draws from —
// handed over whole instead of sampled, which is the entire difference between
// the two modes at this layer.
describe('suggestionsFor', () => {
  it('offers exactly the pool the deal would have drawn from', () => {
    expect(suggestionsFor('shows')).toHaveLength(poolSize('shows'));
    for (const c of suggestionsFor('shows')) expect(c.pool).toBe('shows');
    expect(suggestionsFor(null)).toHaveLength(CATEGORIES.length);
  });

  // Somebody who wrote one wrote it to play it, and it would otherwise be
  // buried under two dozen built-ins.
  it('puts written categories first, and never filters them by pool', () => {
    const mine = normalizeCustomCategory({ label: 'Has a hat' });
    const shows = suggestionsFor('shows', [mine]);
    expect(shows[0]).toEqual(mine);
    // A custom carries no pool of its own on purpose, so it appears in both.
    expect(suggestionsFor('characters', [mine])[0]).toEqual(mine);
  });

  it('drops nothing real when handed a ragged extras list', () => {
    expect(suggestionsFor('shows', [null, undefined])).toHaveLength(poolSize('shows'));
    expect(suggestionsFor('shows', undefined)).toHaveLength(poolSize('shows'));
  });
});
