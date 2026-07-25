import { describe, it, expect } from 'vitest';
import { pickRandomCharacter, getAssignableAnimeList } from './characterPool';

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
