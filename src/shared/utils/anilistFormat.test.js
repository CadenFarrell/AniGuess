import { describe, it, expect } from 'vitest';
import { mergeCharacterEdges, filterAndMapCharacterEdges } from './anilistFormat';

const edge = (id, role, favourites, name = `Char ${id}`) => ({
  role,
  node: { id, favourites, name: { full: name }, image: { large: '' }, description: '' },
});

describe('mergeCharacterEdges', () => {
  it('yields one edge per character across seasons', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'MAIN', 5000), edge(2, 'SUPPORTING', 300)],
      [edge(1, 'MAIN', 5000), edge(2, 'SUPPORTING', 300)],
      [edge(1, 'MAIN', 5000)],
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.node.id).sort()).toEqual([1, 2]);
  });

  it('keeps MAIN when a later season lists the character as SUPPORTING', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'MAIN', 5000)],
      [edge(1, 'SUPPORTING', 5000)],
    ]);

    expect(merged[0].role).toBe('MAIN');
  });

  it('promotes to MAIN when the FIRST season had them as SUPPORTING', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'SUPPORTING', 5000)],
      [edge(1, 'MAIN', 5000)],
    ]);

    expect(merged[0].role).toBe('MAIN');
  });

  it('keeps the highest favourites count seen', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'MAIN', 100)],
      [edge(1, 'MAIN', 9000)],
      [edge(1, 'MAIN', 50)],
    ]);

    expect(merged[0].node.favourites).toBe(9000);
  });

  it('does not mutate the input edges', () => {
    const first = edge(1, 'SUPPORTING', 100);
    mergeCharacterEdges([[first], [edge(1, 'MAIN', 9000)]]);

    expect(first.role).toBe('SUPPORTING');
    expect(first.node.favourites).toBe(100);
  });

  it('skips malformed edges without throwing', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'MAIN', 100), { role: 'MAIN', node: {} }, null, undefined],
      null,
      undefined,
    ]);

    expect(merged).toHaveLength(1);
  });

  it('returns nothing for empty or missing input', () => {
    expect(mergeCharacterEdges([])).toEqual([]);
    expect(mergeCharacterEdges(undefined)).toEqual([]);
  });
});

describe('mergeCharacterEdges + filterAndMapCharacterEdges', () => {
  // The import applies the favourites cutoff and the per-show cap ONCE across
  // the merged franchise, so a character can't slip in twice under one cap.
  it('caps a merged franchise as a single show', () => {
    const season = [edge(1, 'MAIN', 900), edge(2, 'MAIN', 800), edge(3, 'MAIN', 700)];
    const merged = mergeCharacterEdges([season, season, season]);
    const chars = filterAndMapCharacterEdges(merged, { maxCharacters: 2 });

    expect(chars).toHaveLength(2);
    expect(chars.map((c) => c.name)).toEqual(['Char 1', 'Char 2']);
  });

  it('lets a season-2 promotion survive the mainOnly filter', () => {
    const merged = mergeCharacterEdges([
      [edge(1, 'SUPPORTING', 10)],
      [edge(1, 'MAIN', 10)],
    ]);

    // Favourites are far below the cutoff, so this only passes on the MAIN role.
    expect(filterAndMapCharacterEdges(merged, { mainOnly: true })).toHaveLength(1);
  });
});
