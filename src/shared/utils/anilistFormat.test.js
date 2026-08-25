import { describe, it, expect } from 'vitest';
import { mergeCharacterEdges, filterAndMapCharacterEdges, summarizeGroupStats } from './anilistFormat';

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

describe('filterAndMapCharacterEdges favourites', () => {
  // The reason AniRank can rank characters offline at all. Before this the count
  // was used for the cutoff and then dropped, so no saved profile carried it.
  it('stores the favourites count on the mapped character', () => {
    const [char] = filterAndMapCharacterEdges([edge(1, 'MAIN', 4200)]);
    expect(char.favourites).toBe(4200);
  });

  it('stores 0 rather than undefined when AniList omits the count', () => {
    const [char] = filterAndMapCharacterEdges([edge(1, 'MAIN', undefined)]);
    expect(char.favourites).toBe(0);
  });
});

describe('summarizeGroupStats', () => {
  const member = (id, over = {}) => ({
    id,
    title: `Show ${id}`,
    coverImageUrl: `cover-${id}`,
    format: 'TV',
    startDate: { year: 2020, month: 1, day: 1 },
    season: 'WINTER',
    seasonYear: 2020,
    episodes: 12,
    duration: 24,
    averageScore: 80,
    popularity: 1000,
    studio: `Studio ${id}`,
    source: 'MANGA',
    ...over,
  });
  const group = (members, key = members[0].id) => ({
    key,
    title: 'Group',
    coverImageUrl: 'group-cover',
    memberIds: members.map((m) => m.id),
    members,
  });

  it('dates a franchise by its earliest season, not its canonical one', () => {
    const stats = summarizeGroupStats(group([
      member(1, { startDate: { year: 2019, month: 4, day: 1 } }),
      member(2, { startDate: { year: 2013, month: 4, day: 1 } }),
    ], 1));

    expect(stats.startDate.year).toBe(2013);
  });

  it('sums episodes across every season', () => {
    const stats = summarizeGroupStats(group([
      member(1, { episodes: 25 }),
      member(2, { episodes: 12 }),
    ]));

    expect(stats.episodes).toBe(37);
  });

  it('sums the seasons that report a count when others are missing one', () => {
    const stats = summarizeGroupStats(group([
      member(1, { episodes: 25 }),
      member(2, { episodes: null }),
    ]));

    expect(stats.episodes).toBe(25);
  });

  it('takes score and popularity from the canonical member', () => {
    const stats = summarizeGroupStats(group([
      member(1, { averageScore: 60, popularity: 10 }),
      member(2, { averageScore: 90, popularity: 999 }),
    ], 2));

    expect(stats.averageScore).toBe(90);
    expect(stats.popularity).toBe(999);
  });

  it('takes studio, source and duration from the canonical member', () => {
    const stats = summarizeGroupStats(group([
      member(1, { studio: 'Wit', source: 'MANGA', duration: 24 }),
      member(2, { studio: 'MAPPA', source: 'ORIGINAL', duration: 48 }),
    ], 2));

    expect(stats.studio).toBe('MAPPA');
    expect(stats.source).toBe('ORIGINAL');
    // Per-episode, so a sum would be 72 — a length no episode of either season
    // actually has.
    expect(stats.duration).toBe(48);
  });

  // The regression guard: season/seasonYear name the same debut startDate does,
  // so folding them from a different member than startDate lets one card answer
  // 2013 and SPRING 2019 at the same time.
  it('takes season and seasonYear from the earliest member, agreeing with startDate', () => {
    const stats = summarizeGroupStats(group([
      member(1, { startDate: { year: 2019, month: 4, day: 1 }, season: 'SPRING', seasonYear: 2019 }),
      member(2, { startDate: { year: 2013, month: 4, day: 1 }, season: 'SPRING', seasonYear: 2013 }),
    ], 1));

    expect(stats.seasonYear).toBe(2013);
    expect(stats.seasonYear).toBe(stats.startDate.year);
  });

  // Spread over an existing entry, so a null would blank a value an earlier
  // import stored. Absent keys leave it alone; that is what backfillStats wants.
  it('omits fields AniList has no value for', () => {
    const stats = summarizeGroupStats(group([
      member(1, { episodes: null, averageScore: null, popularity: null, startDate: null }),
    ]));

    expect(stats).not.toHaveProperty('episodes');
    expect(stats).not.toHaveProperty('averageScore');
    expect(stats).not.toHaveProperty('popularity');
    expect(stats).not.toHaveProperty('startDate');
  });

  it('returns nothing for a group with no members', () => {
    expect(summarizeGroupStats({ key: 1, members: [] })).toEqual({});
    expect(summarizeGroupStats(undefined)).toEqual({});
  });
});
