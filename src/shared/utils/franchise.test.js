import { describe, it, expect } from 'vitest';
import { groupIntoFranchises, franchiseTitleKey, SEASON_RELATIONS } from './franchise';

describe('franchiseTitleKey', () => {
  const sameShow = (a, b) => expect(franchiseTitleKey(a)).toBe(franchiseTitleKey(b));
  const differentShows = (a, b) => expect(franchiseTitleKey(a)).not.toBe(franchiseTitleKey(b));

  it('merges the season-marker forms AniList actually uses', () => {
    sameShow('Attack on Titan', 'Attack on Titan Season 2');
    sameShow('Attack on Titan', 'Attack on Titan: The Final Season');
    sameShow('Attack on Titan', 'Attack on Titan - Final Season');
    sameShow('My Hero Academia', 'My Hero Academia 2nd Season');
    sameShow('Bleach', 'Bleach Cour 2');
    sameShow('Vinland Saga', 'Vinland Saga S2');
    sameShow('Mob Psycho 100', 'Mob Psycho 100 II');
    sameShow('Mob Psycho 100', 'Mob Psycho 100 III');
  });

  it('strips stacked markers down to the base title', () => {
    expect(franchiseTitleKey('SPY x FAMILY Season 1 Part 2')).toBe('spy x family');
  });

  it('is case- and whitespace-insensitive', () => {
    sameShow('  JUJUTSU KAISEN  ', 'jujutsu kaisen season 2');
  });

  it('keeps a bare trailing number, which is part of the real name', () => {
    // Stripping digits would turn these into "Mob Psycho" and "JUJUTSU KAISEN".
    expect(franchiseTitleKey('Mob Psycho 100')).toBe('mob psycho 100');
    expect(franchiseTitleKey('JUJUTSU KAISEN 0')).toBe('jujutsu kaisen 0');
    differentShows('Mob Psycho 100', 'Mob Psycho');
  });

  it('does not merge shows that merely share a cast', () => {
    // A spin-off and an arc name are not season markers. groupIntoFranchises
    // handles these at import time; the heuristic must not guess.
    differentShows('Attack on Titan', 'Attack on Titan: Junior High');
    differentShows('Demon Slayer', 'Demon Slayer: Entertainment District Arc');
    differentShows('Naruto', 'Naruto Shippuden');
  });

  it('does not merge genuinely different shows', () => {
    differentShows('Steins;Gate', 'Steins;Gate 0');
    differentShows('Code Geass', 'Code Geass: Akito the Exiled');
  });

  it('never returns empty, even for a title that is only a marker', () => {
    expect(franchiseTitleKey('Season 2')).toBe('season 2');
    expect(franchiseTitleKey('')).toBe('');
    expect(franchiseTitleKey(undefined)).toBe('');
  });

  it('is idempotent', () => {
    const once = franchiseTitleKey('Attack on Titan Season 3 Part 2');
    expect(franchiseTitleKey(once)).toBe(once);
  });
});

describe('SEASON_RELATIONS', () => {
  // anilist.js's seasonRelatedIds filters relation edges through this set, so
  // it decides what counts as "the same show" before grouping ever runs.
  it('covers season chains and the extras hanging off them', () => {
    for (const rel of ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY']) {
      expect(SEASON_RELATIONS.has(rel)).toBe(true);
    }
  });

  it('excludes relations that link genuinely different shows', () => {
    // Attack on Titan: Junior High (SPIN_OFF) and the recap movies (SUMMARY)
    // share a cast but should keep their own titles.
    for (const rel of ['SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'CHARACTER', 'OTHER']) {
      expect(SEASON_RELATIONS.has(rel)).toBe(false);
    }
  });
});

// Minimal stand-in for what fetchUserAnimeList hands over. Only the fields
// groupIntoFranchises reads are worth spelling out.
const media = (id, title, { format = 'TV', year = 2013, relatedIds = [] } = {}) => ({
  id,
  title,
  coverImageUrl: `cover-${id}`,
  format,
  startDate: { year, month: 4, day: 1 },
  relatedIds,
});

describe('groupIntoFranchises', () => {
  it('collapses a season chain into one group', () => {
    const groups = groupIntoFranchises([
      media(1, 'Attack on Titan', { year: 2013, relatedIds: [2] }),
      media(2, 'Attack on Titan Season 2', { year: 2017, relatedIds: [1, 3] }),
      media(3, 'Attack on Titan Season 3', { year: 2018, relatedIds: [2] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Attack on Titan');
    expect(groups[0].memberIds.sort()).toEqual([1, 2, 3]);
  });

  it('bridges seasons through a related id the user does not own', () => {
    // The AoT S3/S4 case the source comment calls out: the user has S3 and S4
    // but not "S3 Part 2" (id 99), which is the only thing linking them.
    const groups = groupIntoFranchises([
      media(3, 'Attack on Titan Season 3', { year: 2018, relatedIds: [99] }),
      media(4, 'Attack on Titan Final Season', { year: 2020, relatedIds: [99] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds.sort()).toEqual([3, 4]);
  });

  it('prefers a TV season over an OVA for the franchise title', () => {
    const groups = groupIntoFranchises([
      media(10, 'Some Show OVA', { format: 'OVA', year: 2011, relatedIds: [11] }),
      media(11, 'Some Show', { format: 'TV', year: 2012, relatedIds: [10] }),
    ]);

    expect(groups).toHaveLength(1);
    // The OVA aired FIRST, so this only passes if format beats air date.
    expect(groups[0].title).toBe('Some Show');
    expect(groups[0].coverImageUrl).toBe('cover-11');
  });

  it('breaks a TV-vs-TV tie by earliest air date', () => {
    const groups = groupIntoFranchises([
      media(20, 'Later Season', { year: 2020, relatedIds: [21] }),
      media(21, 'First Season', { year: 2015, relatedIds: [20] }),
    ]);

    expect(groups[0].title).toBe('First Season');
  });

  it('keeps unrelated shows apart', () => {
    const groups = groupIntoFranchises([
      media(30, 'Show A'),
      media(31, 'Show B'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.title)).toEqual(['Show A', 'Show B']);
  });

  it('orders groups by where their canonical member sat in the input', () => {
    const groups = groupIntoFranchises([
      media(40, 'Zebra Show'),
      media(41, 'Apple Show', { relatedIds: [42] }),
      media(42, 'Apple Show Season 2', { year: 2020, relatedIds: [41] }),
    ]);

    expect(groups.map((g) => g.title)).toEqual(['Zebra Show', 'Apple Show']);
  });

  it('leaves a lone entry as its own group', () => {
    const groups = groupIntoFranchises([media(50, 'Solo Show')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toEqual([50]);
  });

  it('returns nothing for an empty or missing list', () => {
    expect(groupIntoFranchises([])).toEqual([]);
    expect(groupIntoFranchises(undefined)).toEqual([]);
  });

  // Documents a deliberate consequence of unioning transitively over SEQUEL,
  // not a bug: a long sequel chain becomes ONE entry named after the original.
  // If Boruto should stand alone, the fix is to stop following SEQUEL across a
  // time skip — change SEASON_RELATIONS, and change this test with it.
  it('folds a long sequel chain under the original title', () => {
    const groups = groupIntoFranchises([
      media(60, 'Naruto', { year: 2002, relatedIds: [61] }),
      media(61, 'Naruto Shippuden', { year: 2007, relatedIds: [60, 62] }),
      media(62, 'Boruto', { year: 2017, relatedIds: [61] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Naruto');
  });
});
