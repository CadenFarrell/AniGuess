import { describe, it, expect } from 'vitest';
import {
  mergeAnimeIntoProfile,
  dedupeProfileAnimeList,
  classifyImportGroups,
  mergeImportedAnilistIds,
} from './profileMerge';

const char = (name) => ({ id: `anilist_${name}`, name, role: 'Main', genres: [] });
const entry = (id, title, names) => ({ id, title, characters: names.map(char) });
const profileWith = (animeList) => ({ id: 'p1', name: 'Player', animeList });
// A checklist row as groupIntoFranchises produces it: `key`, not `animeId`.
const group = (key, title, memberIds = [key]) => ({ key, title, memberIds });

describe('mergeAnimeIntoProfile', () => {
  it('folds old per-season entries into one canonical entry', () => {
    const profile = profileWith([
      entry('anilist_anime_1', 'Attack on Titan', ['Eren', 'Mikasa']),
      entry('anilist_anime_2', 'Attack on Titan Season 2', ['Eren', 'Mikasa', 'Ymir']),
      entry('anilist_anime_3', 'Attack on Titan Season 3', ['Eren', 'Levi']),
    ]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1,
      memberIds: [1, 2, 3],
      title: 'Attack on Titan',
      characters: [char('Eren'), char('Mikasa'), char('Ymir'), char('Levi')],
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].id).toBe('anilist_anime_1');
    expect(merged.animeList[0].title).toBe('Attack on Titan');
    expect(merged.animeList[0].characters.map((c) => c.name).sort())
      .toEqual(['Eren', 'Levi', 'Mikasa', 'Ymir']);
  });

  it('counts only genuinely new characters as added', () => {
    const profile = profileWith([
      entry('anilist_anime_1', 'Show', ['A']),
      entry('anilist_anime_2', 'Show Season 2', ['A', 'B']),
    ]);

    const { addedAnime, addedChars } = mergeAnimeIntoProfile(profile, [{
      animeId: 1,
      memberIds: [1, 2],
      title: 'Show',
      characters: [char('A'), char('B'), char('C')],
    }]);

    // A and B were already in the profile; only C is new. Nothing was added at
    // the show level — two entries became one.
    expect(addedAnime).toBe(0);
    expect(addedChars).toBe(1);
  });

  it('adds a brand new franchise wholesale', () => {
    const { profile: merged, addedAnime, addedChars } = mergeAnimeIntoProfile(
      profileWith([]),
      [{ animeId: 7, memberIds: [7, 8], title: 'New Show', characters: [char('X'), char('Y')] }]
    );

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].id).toBe('anilist_anime_7');
    expect(addedAnime).toBe(1);
    expect(addedChars).toBe(2);
  });

  it('folds a season entry whose id does not match any group member', () => {
    // Profiles from generateProfiles.js / hand-entry have ids the franchise's
    // memberIds never cover, so the title key is the only thing that links them.
    const profile = profileWith([
      entry('1730000000000', 'Attack on Titan', ['Eren']),
      entry('1730000000001', 'Attack on Titan Season 2', ['Eren', 'Ymir']),
    ]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 16498,
      memberIds: [16498, 20958],
      title: 'Attack on Titan',
      characters: [char('Eren'), char('Mikasa')],
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].id).toBe('anilist_anime_16498');
    expect(merged.animeList[0].characters.map((c) => c.name)).toEqual(['Eren', 'Ymir', 'Mikasa']);
  });

  it('does not duplicate a generateProfiles-seeded list on re-import', () => {
    // The regression that duplicated caden's list: seeded ids are
    // `<player>_anime_<n>` and titles are hand-shortened, so neither the id nor
    // the title key matches the imported group.
    const profile = profileWith([
      entry('caden_anime_0', 'Demon Slayer', ['Tanjiro', 'Nezuko', 'Zenitsu']),
      entry('caden_anime_1', 'Re:Zero', ['Subaru', 'Emilia', 'Rem']),
    ]);

    const { profile: merged, addedAnime } = mergeAnimeIntoProfile(profile, [
      {
        animeId: 101922,
        memberIds: [101922, 142329],
        title: 'Demon Slayer: Kimetsu no Yaiba',
        characters: [char('Tanjiro'), char('Nezuko'), char('Zenitsu'), char('Giyu')],
      },
      {
        animeId: 21355,
        memberIds: [21355],
        title: 'Re:ZERO -Starting Life in Another World-',
        characters: [char('Subaru'), char('Emilia'), char('Rem'), char('Ram')],
      },
    ]);

    expect(merged.animeList).toHaveLength(2);
    expect(addedAnime).toBe(0);
    // Keeps the user's shorter titles, but gains the AniList ids so the NEXT
    // import matches by id and never reaches the cast fallback.
    expect(merged.animeList.map((a) => a.title)).toEqual(['Demon Slayer', 'Re:Zero']);
    expect(merged.animeList.map((a) => a.id))
      .toEqual(['anilist_anime_101922', 'anilist_anime_21355']);
  });

  it('is stable when the same import runs twice', () => {
    const group = {
      animeId: 101922,
      memberIds: [101922],
      title: 'Demon Slayer: Kimetsu no Yaiba',
      characters: [char('Tanjiro'), char('Nezuko'), char('Zenitsu')],
    };
    const seeded = profileWith([entry('caden_anime_0', 'Demon Slayer', ['Tanjiro', 'Nezuko'])]);

    const once = mergeAnimeIntoProfile(seeded, [group]).profile;
    const twice = mergeAnimeIntoProfile(once, [group]).profile;

    expect(twice.animeList).toEqual(once.animeList);
  });

  it('leaves a manually-added entry alone when nothing matches', () => {
    const profile = profileWith([entry('1730000000000', 'My Handwritten Show', ['Q'])]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 5, memberIds: [5], title: 'Different Show', characters: [char('Z')],
    }]);

    expect(merged.animeList).toHaveLength(2);
    expect(merged.animeList[0].id).toBe('1730000000000');
  });

  it('absorbs a manually-added entry on an exact title match', () => {
    const profile = profileWith([entry('1730000000000', 'attack on titan', ['Eren'])]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1], title: 'Attack on Titan', characters: [char('Mikasa')],
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].id).toBe('anilist_anime_1');
    expect(merged.animeList[0].characters.map((c) => c.name)).toEqual(['Eren', 'Mikasa']);
  });

  it('does not mutate the profile it was given', () => {
    const profile = profileWith([entry('anilist_anime_1', 'Show', ['A'])]);

    mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1], title: 'Show Renamed', characters: [char('B')],
    }]);

    expect(profile.animeList).toHaveLength(1);
    expect(profile.animeList[0].title).toBe('Show');
    expect(profile.animeList[0].characters).toHaveLength(1);
  });

  it('treats a missing memberIds as a single-member group', () => {
    const profile = profileWith([entry('anilist_anime_9', 'Show', ['A'])]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 9, title: 'Show', characters: [char('B')],
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].characters).toHaveLength(2);
  });
});

// The regression that made AniRank unplayable: the import fetched startDate
// and friends, then persisted only { id, title, characters }, so every ranking
// axis had null to sort by and no round could ever be dealt.
describe('mergeAnimeIntoProfile — per-show stats', () => {
  const stats = {
    coverImageUrl: 'cover.jpg',
    startDate: { year: 2013, month: 4, day: 7 },
    episodes: 25,
    averageScore: 84,
    popularity: 500000,
  };

  it('stores the stats on a newly added show', () => {
    const { profile: merged } = mergeAnimeIntoProfile(profileWith([]), [{
      animeId: 1, memberIds: [1], title: 'Attack on Titan', characters: [char('Eren')], ...stats,
    }]);

    expect(merged.animeList[0]).toMatchObject(stats);
  });

  it('backfills stats onto an entry saved before the fields existed', () => {
    const profile = profileWith([entry('anilist_anime_1', 'Attack on Titan', ['Eren'])]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1], title: 'Attack on Titan', characters: [char('Eren')], ...stats,
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0]).toMatchObject(stats);
  });

  it('does not overwrite a stat the entry already carries', () => {
    const profile = profileWith([
      { ...entry('anilist_anime_1', 'Attack on Titan', ['Eren']), averageScore: 99 },
    ]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1], title: 'Attack on Titan', characters: [char('Eren')], ...stats,
    }]);

    expect(merged.animeList[0].averageScore).toBe(99);
    expect(merged.animeList[0].episodes).toBe(25);
  });

  it('leaves an entry untouched when the import carries no stats', () => {
    const profile = profileWith([entry('anilist_anime_1', 'Show', ['A'])]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1], title: 'Show', characters: [char('A')],
    }]);

    expect(merged.animeList[0]).not.toHaveProperty('startDate');
  });

  it('keeps the surviving entry stats when seasons are folded together', () => {
    const profile = profileWith([
      entry('anilist_anime_1', 'Attack on Titan', ['Eren']),
      entry('anilist_anime_2', 'Attack on Titan Season 2', ['Ymir']),
    ]);

    const { profile: merged } = mergeAnimeIntoProfile(profile, [{
      animeId: 1, memberIds: [1, 2], title: 'Attack on Titan',
      characters: [char('Eren'), char('Ymir')], ...stats,
    }]);

    expect(merged.animeList).toHaveLength(1);
    expect(merged.animeList[0].startDate.year).toBe(2013);
  });
});

describe('dedupeProfileAnimeList', () => {
  it('merges separate season entries into one show', () => {
    // The case the user actually hits: an old import saved each season on its
    // own, so Eren was listed three times across the profile.
    const result = dedupeProfileAnimeList([
      entry('a', 'Attack on Titan', ['Eren', 'Mikasa']),
      entry('b', 'Attack on Titan Season 2', ['Eren', 'Mikasa', 'Ymir']),
      entry('c', 'Attack on Titan: The Final Season', ['Eren', 'Levi']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Attack on Titan');
    expect(result[0].characters.map((c) => c.name)).toEqual(['Eren', 'Mikasa', 'Ymir', 'Levi']);
  });

  it('names the merged show after the base title even when a season comes first', () => {
    const result = dedupeProfileAnimeList([
      entry('b', 'Attack on Titan: The Final Season', ['Levi']),
      entry('a', 'Attack on Titan', ['Eren']),
    ]);

    expect(result[0].title).toBe('Attack on Titan');
    expect(result[0].id).toBe('a');
    // Characters keep first-seen order regardless of which title won.
    expect(result[0].characters.map((c) => c.name)).toEqual(['Levi', 'Eren']);
  });

  it('merges a seeded short title with an imported long one via shared cast', () => {
    // The generateProfiles.js case: neither the id nor the title lines up, so
    // the cast is the only thing linking them.
    const result = dedupeProfileAnimeList([
      entry('caden_anime_5', 'Demon Slayer', ['Tanjiro', 'Nezuko', 'Zenitsu', 'Inosuke']),
      entry('anilist_anime_101922', 'Demon Slayer: Kimetsu no Yaiba', ['Tanjiro', 'Nezuko', 'Zenitsu', 'Giyu']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Demon Slayer');
    expect(result[0].characters.map((c) => c.name))
      .toEqual(['Tanjiro', 'Nezuko', 'Zenitsu', 'Inosuke', 'Giyu']);
  });

  it('does not merge shows that share only a stray name', () => {
    // Two unrelated shows with one common given name between big casts.
    const result = dedupeProfileAnimeList([
      entry('a', 'Show A', ['Rin', 'Alpha', 'Beta', 'Gamma', 'Delta']),
      entry('b', 'Show B', ['Rin', 'Ichi', 'Ni', 'San', 'Shi']),
    ]);

    expect(result).toHaveLength(2);
  });

  it('does not merge on two shared names when casts are large', () => {
    const big = (extra) => ['Rin', 'Yuki', ...extra];
    const result = dedupeProfileAnimeList([
      entry('a', 'Show A', big(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])),
      entry('b', 'Show B', big(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'])),
    ]);

    // 2 shared, but only 25% of the smaller cast — under the ratio floor.
    expect(result).toHaveLength(2);
  });

  it('merges a spin-off that carries the same cast', () => {
    // Accepted consequence of cast matching: a spin-off stops being its own
    // entry rather than listing the same characters a second time.
    const result = dedupeProfileAnimeList([
      entry('a', 'Attack on Titan', ['Eren', 'Mikasa', 'Levi']),
      entry('b', 'Attack on Titan: Junior High', ['Eren', 'Mikasa', 'Levi']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Attack on Titan');
  });

  it('keeps an empty entry separate instead of swallowing it', () => {
    const result = dedupeProfileAnimeList([
      entry('a', 'Show A', ['Eren', 'Mikasa']),
      entry('b', 'Show B', []),
    ]);

    expect(result).toHaveLength(2);
  });

  it('collapses entries sharing a title and merges their casts', () => {
    const result = dedupeProfileAnimeList([
      entry('a', 'Attack on Titan', ['Eren', 'Mikasa']),
      entry('b', 'attack on titan', ['Mikasa', 'Levi']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(result[0].characters.map((c) => c.name)).toEqual(['Eren', 'Mikasa', 'Levi']);
  });

  it('drops repeated characters inside one entry', () => {
    const result = dedupeProfileAnimeList([entry('a', 'Show', ['Eren', 'eren', 'Mikasa'])]);

    expect(result[0].characters.map((c) => c.name)).toEqual(['Eren', 'Mikasa']);
  });

  it('folds diacritic spelling variants together', () => {
    const result = dedupeProfileAnimeList([entry('a', 'Show', ['Jūjutsu Gojo', 'Jujutsu Gojo'])]);

    expect(result[0].characters).toHaveLength(1);
  });

  it('is idempotent', () => {
    const input = [
      entry('a', 'Show', ['A', 'B']),
      entry('b', 'Show', ['B', 'C']),
      entry('c', 'Other', ['D']),
    ];
    const once = dedupeProfileAnimeList(input);

    expect(dedupeProfileAnimeList(once)).toEqual(once);
  });

  it('does not mutate its input', () => {
    const input = [entry('a', 'Show', ['A']), entry('b', 'Show', ['B'])];
    dedupeProfileAnimeList(input);

    expect(input).toHaveLength(2);
    expect(input[0].characters).toHaveLength(1);
  });

  it('leaves a clean list untouched and tolerates empty input', () => {
    const clean = [entry('a', 'Show A', ['A']), entry('b', 'Show B', ['B'])];

    expect(dedupeProfileAnimeList(clean)).toEqual(clean);
    expect(dedupeProfileAnimeList([])).toEqual([]);
    expect(dedupeProfileAnimeList(undefined)).toEqual([]);
  });

  it('survives an entry with no characters array', () => {
    expect(dedupeProfileAnimeList([{ id: 'a', title: 'Show' }])[0].characters).toEqual([]);
  });
});

describe('classifyImportGroups', () => {
  it('treats everything as new for an empty profile', () => {
    const { counts, suggested } = classifyImportGroups(profileWith([]), [
      group(1, 'A'),
      group(2, 'B'),
    ]);

    expect(counts).toEqual({ new: 2, partial: 0, known: 0 });
    expect([...suggested]).toEqual([1, 2]);
  });

  it('marks a fully covered franchise as known so it is not re-fetched', () => {
    // The point of the feature: only one entry survives the merge, but the
    // recorded ids still prove both seasons were paid for.
    const profile = {
      ...profileWith([entry('anilist_anime_1', 'Show', ['A'])]),
      anilistImportedIds: [1, 2],
    };

    const { byKey, suggested, counts } = classifyImportGroups(profile, [group(1, 'Show', [1, 2])]);

    expect(byKey.get(1)).toBe('known');
    expect(suggested.size).toBe(0);
    expect(counts.known).toBe(1);
  });

  it('marks a franchise that gained a season as partial and suggests it', () => {
    const profile = {
      ...profileWith([entry('anilist_anime_1', 'Show', ['A'])]),
      anilistImportedIds: [1, 2],
    };

    const { byKey, counts, suggested } = classifyImportGroups(profile, [group(1, 'Show', [1, 2, 3])]);

    expect(byKey.get(1)).toBe('partial');
    expect(counts.partial).toBe(1);
    expect(suggested.has(1)).toBe(true);
  });

  it('does not guess partial on a profile imported before ids were recorded', () => {
    // Inferring coverage from the surviving entry id would flag every
    // multi-season group as partial and re-fetch the whole list — the exact
    // cost this is meant to remove.
    const profile = profileWith([entry('anilist_anime_1', 'Show', ['A'])]);

    const { byKey, hasCoverage } = classifyImportGroups(profile, [group(1, 'Show', [1, 2, 3])]);

    expect(hasCoverage).toBe(false);
    expect(byKey.get(1)).toBe('known');
  });

  it('matches a hand-added season entry by title key when no id lines up', () => {
    const profile = profileWith([entry('1730000000000', 'Attack on Titan Season 2', ['Eren'])]);

    const { byKey } = classifyImportGroups(profile, [group(16498, 'Attack on Titan', [16498, 20958])]);

    expect(byKey.get(16498)).toBe('known');
  });

  it('calls a hand-shortened seeded title new, and lets the merge fix it', () => {
    // franchiseTitleKey does not strip subtitles, so 'Demon Slayer' and 'Demon
    // Slayer: Kimetsu no Yaiba' cannot be linked before the fetch. That costs
    // one import; mergeAnimeIntoProfile's cast heuristic then folds them and
    // rewrites the id, so it is known forever after. Asserted so nobody "fixes"
    // this into a fuzzy title match and starts merging unrelated shows.
    const profile = profileWith([entry('caden_anime_0', 'Demon Slayer', ['Tanjiro', 'Nezuko'])]);

    const { byKey } = classifyImportGroups(profile, [group(101922, 'Demon Slayer: Kimetsu no Yaiba')]);

    expect(byKey.get(101922)).toBe('new');
  });

  it('lets one profile entry mark several groups as known', () => {
    const profile = profileWith([entry('anilist_anime_1', 'Show', ['A'])]);

    const { counts } = classifyImportGroups(profile, [group(1, 'Show'), group(9, 'Show')]);

    expect(counts.known).toBe(2);
  });

  it('tolerates a bare or missing profile', () => {
    expect(classifyImportGroups(profileWith([]), []).counts).toEqual({ new: 0, partial: 0, known: 0 });
    expect(classifyImportGroups(undefined, [group(1, 'A')]).byKey.get(1)).toBe('new');
    expect(classifyImportGroups({ id: 'p1', name: 'P' }, [group(1, 'A')]).counts.new).toBe(1);
  });

  it('sees a group as known immediately after importing it', () => {
    // The end-to-end guarantee the feature rests on: merge and classify must
    // agree, or a re-import re-fetches exactly what it just fetched.
    const imported = { animeId: 1, memberIds: [1, 2], title: 'Show', characters: [char('A')] };
    const { profile: merged } = mergeAnimeIntoProfile(profileWith([]), [imported]);

    const after = { ...merged, anilistImportedIds: mergeImportedAnilistIds(undefined, [1, 2]) };

    expect(classifyImportGroups(after, [group(1, 'Show', [1, 2])]).suggested.size).toBe(0);
  });
});

describe('mergeImportedAnilistIds', () => {
  it('unions, dedupes and sorts', () => {
    expect(mergeImportedAnilistIds([3, 1], [2, 1])).toEqual([1, 2, 3]);
  });

  it('tolerates a profile that has never recorded ids', () => {
    expect(mergeImportedAnilistIds(undefined, [2, 1])).toEqual([1, 2]);
    expect(mergeImportedAnilistIds([1], undefined)).toEqual([1]);
  });

  it('is stable when the same import runs twice', () => {
    const once = mergeImportedAnilistIds(undefined, [5, 3]);

    expect(mergeImportedAnilistIds(once, [5, 3])).toEqual(once);
  });
});
