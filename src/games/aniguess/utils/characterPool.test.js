import { describe, it, expect } from 'vitest';
import { pickRandomCharacter, getAssignableAnimeList, filterAnimeList } from './characterPool';

const char = (name) => ({ id: `anilist_${name}`, name, role: 'Main', genres: [] });
const anime = (title, names) => ({ id: title, title, characters: names.map(char) });

// pickRandomCharacter uses Math.random, so assert over the SET of reachable
// results rather than a single draw. 400 draws over a pool of <=4 makes a
// missed entry effectively impossible without making the test flaky.
const drawSet = (animeList, twoStep = false, excluding = null) => {
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const picked = pickRandomCharacter(animeList, twoStep, excluding);
    seen.add(`${picked.series}::${picked.name}`);
  }
  return seen;
};

describe('pickRandomCharacter', () => {
  it('offers a character listed under two shows only once', () => {
    // The spin-off / recap-movie case franchise grouping deliberately leaves
    // apart: same cast, different titles.
    const results = drawSet([
      anime('Attack on Titan', ['Eren', 'Mikasa']),
      anime('Attack on Titan: Junior High', ['Eren', 'Mikasa']),
    ]);

    expect(results).toEqual(new Set([
      'Attack on Titan::Eren',
      'Attack on Titan::Mikasa',
    ]));
  });

  it('keeps the first entry seen, so the reveal still has a series', () => {
    const picked = pickRandomCharacter([
      anime('Original Show', ['Solo']),
      anime('Recap Movie', ['Solo']),
    ]);

    expect(picked.series).toBe('Original Show');
  });

  it('folds diacritic spelling variants across shows', () => {
    const results = drawSet([
      anime('Season 1', ['Jūjutsu Gojo']),
      anime('Season 2', ['Jujutsu Gojo']),
    ]);

    expect(results.size).toBe(1);
  });

  it('excludes a character even under a different series title', () => {
    // The re-roll case: excluding Eren-from-AoT must not hand back
    // Eren-from-Junior-High, which is the same person.
    const results = drawSet(
      [
        anime('Attack on Titan', ['Eren', 'Mikasa']),
        anime('Attack on Titan: Junior High', ['Eren']),
      ],
      false,
      { name: 'Eren', series: 'Attack on Titan' }
    );

    expect(results).toEqual(new Set(['Attack on Titan::Mikasa']));
  });

  it('still returns the only option when excluding would empty the pool', () => {
    const picked = pickRandomCharacter(
      [anime('Show', ['Solo'])],
      false,
      { name: 'Solo', series: 'Show' }
    );

    expect(picked.name).toBe('Solo');
  });

  it('dedupes within one show under twoStepRandom too', () => {
    const results = drawSet([anime('Show', ['Eren', 'eren', 'Mikasa'])], true);

    expect(results.size).toBe(2);
  });

  it('reaches every show under twoStepRandom', () => {
    const results = drawSet([anime('A', ['A1']), anime('B', ['B1'])], true);

    expect(results).toEqual(new Set(['A::A1', 'B::B1']));
  });

  it('returns null when there is nothing to pick', () => {
    expect(pickRandomCharacter([])).toBeNull();
    expect(pickRandomCharacter(null)).toBeNull();
  });
});

describe('getAssignableAnimeList', () => {
  const guesser = { id: 'g', animeList: [anime('Shared', ['A']), anime('Solo', ['B'])] };
  const other = { id: 'o', animeList: [anime('Shared', ['A'])] };

  it('narrows to shows another player also has', () => {
    const result = getAssignableAnimeList(guesser, [guesser, other], true);

    expect(result.map((a) => a.title)).toEqual(['Shared']);
  });

  it('returns everything when sharedShowsOnly is off', () => {
    const result = getAssignableAnimeList(guesser, [guesser, other], false);

    expect(result.map((a) => a.title)).toEqual(['Shared', 'Solo']);
  });

  it('drops shows with no characters', () => {
    const withEmpty = { id: 'g', animeList: [anime('Shared', ['A']), anime('Empty', [])] };
    const result = getAssignableAnimeList(withEmpty, null, false);

    expect(result.map((a) => a.title)).toEqual(['Shared']);
  });
});

describe('filterAnimeList', () => {
  const list = [
    anime('Jujutsu Kaisen', ['Yuji Itadori', 'Megumi Fushiguro']),
    anime('Attack on Titan', ['Eren', 'Mikasa']),
  ];

  it('returns the list untouched when the query is empty or blank', () => {
    expect(filterAnimeList(list, '')).toBe(list);
    expect(filterAnimeList(list, '   ')).toBe(list);
  });

  it('keeps a title match with its whole cast', () => {
    // Typing a show name means "let me browse that show", not "show me the
    // characters whose names happen to contain these letters".
    const result = filterAnimeList(list, 'jujutsu');

    expect(result.map((a) => a.title)).toEqual(['Jujutsu Kaisen']);
    expect(result[0].characters.map((c) => c.name)).toEqual(['Yuji Itadori', 'Megumi Fushiguro']);
  });

  it('narrows a show to only the matching characters on a name match', () => {
    const result = filterAnimeList(list, 'mikasa');

    expect(result.map((a) => a.title)).toEqual(['Attack on Titan']);
    expect(result[0].characters.map((c) => c.name)).toEqual(['Mikasa']);
  });

  it('matches mid-word, not just prefixes', () => {
    const result = filterAnimeList(list, 'titan');

    expect(result.map((a) => a.title)).toEqual(['Attack on Titan']);
  });

  it('folds diacritics in both titles and character names', () => {
    // Nobody types ō / ū, and the same name arrives spelled either way from
    // different seasons — same fold guessSuggest.js uses for the guess box.
    const accented = [anime('Jūjutsu Kaisen', ['Gojō Satoru']), anime('Other', ['Nobody'])];

    expect(filterAnimeList(accented, 'jujutsu').map((a) => a.title)).toEqual(['Jūjutsu Kaisen']);
    expect(filterAnimeList(accented, 'gojo')[0].characters.map((c) => c.name)).toEqual(['Gojō Satoru']);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(filterAnimeList(list, '  EREN ').map((a) => a.title)).toEqual(['Attack on Titan']);
  });

  it('keeps every show a query reaches', () => {
    const result = filterAnimeList(
      [anime('Jujutsu Kaisen', ['Yuji']), anime('Jujutsu Kaisen 0', ['Yuta'])],
      'jujutsu'
    );

    expect(result.map((a) => a.title)).toEqual(['Jujutsu Kaisen', 'Jujutsu Kaisen 0']);
  });

  it('returns nothing when the query matches neither a title nor a name', () => {
    expect(filterAnimeList(list, 'zzzz')).toEqual([]);
  });
});
