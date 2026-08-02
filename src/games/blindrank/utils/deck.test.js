import { describe, it, expect } from 'vitest';
import { yearOf, eligibleShows, buildDeck } from './deck';

const anime = (title, year) => ({
  title,
  startDate: year == null ? null : { year, month: 4, day: 1 },
  coverImageUrl: `${title}.jpg`,
});
const player = (id, list) => ({ id, name: id, animeList: list });

// Ten distinct franchises, enough to fill a default board.
const TEN = [
  anime('Cowboy Bebop', 1998), anime('Bleach', 2004), anime('Naruto', 2002),
  anime('Death Note', 2006), anime('Steins;Gate', 2011), anime('Mob Psycho 100', 2016),
  anime('Jujutsu Kaisen', 2020), anime('Akira', 1988), anime('Monster', 2004),
  anime('Vinland Saga', 2019),
];

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

describe('yearOf', () => {
  it('reads the year off the startDate every saved profile already carries', () => {
    expect(yearOf(anime('X', 1998))).toBe(1998);
  });

  it('rejects a show with no usable air date rather than ranking it as year zero', () => {
    expect(yearOf(anime('X', null))).toBe(null);
    expect(yearOf({ title: 'X' })).toBe(null);
    expect(yearOf({ title: 'X', startDate: {} })).toBe(null);
    expect(yearOf({ title: 'X', startDate: { year: 0 } })).toBe(null);
    expect(yearOf(null)).toBe(null);
  });
});

describe('eligibleShows', () => {
  it('keeps only shows every player has, since everyone ranks the same ten', () => {
    const out = eligibleShows([
      player('a', [anime('Bleach', 2004), anime('Naruto', 2002)]),
      player('b', [anime('Naruto', 2002), anime('Akira', 1988)]),
    ]);
    expect(out.map((s) => s.title)).toEqual(['Naruto']);
  });

  it('unions the lists when the shared toggle is off', () => {
    const out = eligibleShows([
      player('a', [anime('Bleach', 2004)]),
      player('b', [anime('Akira', 1988)]),
    ], { sharedOnly: false });
    expect(out.map((s) => s.title).sort()).toEqual(['Akira', 'Bleach']);
  });

  it('collapses a multi-season run into one entry, so four seasons are not four slots', () => {
    const out = eligibleShows([player('a', [
      anime('Attack on Titan', 2013),
      anime('Attack on Titan Season 2', 2017),
      anime('Attack on Titan: The Final Season', 2020),
    ])], { sharedOnly: false });
    expect(out).toHaveLength(1);
  });

  it('dates a franchise by its earliest season, the one people actually date', () => {
    const out = eligibleShows([player('a', [
      anime('Attack on Titan Season 2', 2017),
      anime('Attack on Titan', 2013),
    ])], { sharedOnly: false });
    expect(out[0].year).toBe(2013);
  });

  it('matches a franchise across players who saved different seasons of it', () => {
    const out = eligibleShows([
      player('a', [anime('Attack on Titan', 2013)]),
      player('b', [anime('Attack on Titan Season 2', 2017)]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].year).toBe(2013);
  });

  it('drops shows with no air date, because there is nothing to rank them by', () => {
    const out = eligibleShows([player('a', [anime('Bleach', 2004), anime('Mystery', null)])], { sharedOnly: false });
    expect(out.map((s) => s.title)).toEqual(['Bleach']);
  });

  it('identifies a show by franchise key, so two spellings are one show', () => {
    const out = eligibleShows([player('a', [anime('Cowboy Bebop', 1998)])], { sharedOnly: false });
    expect(out[0].id).toBeTruthy();
    expect(out[0]).toMatchObject({ title: 'Cowboy Bebop', year: 1998, coverImageUrl: 'Cowboy Bebop.jpg' });
  });

  it('handles a player with no list, and an empty roster', () => {
    expect(eligibleShows([{ id: 'a' }, player('b', [anime('X', 2000)])])).toEqual([]);
    expect(eligibleShows([])).toEqual([]);
    expect(eligibleShows(null)).toEqual([]);
  });
});

describe('buildDeck', () => {
  const two = [player('a', TEN), player('b', TEN)];

  it('deals a full board from a big enough shared list', () => {
    const { deck, enough, candidates } = buildDeck(two, { rng: seeded(1) });
    expect(enough).toBe(true);
    expect(deck).toHaveLength(10);
    expect(candidates).toBe(10);
    expect(new Set(deck.map((s) => s.id)).size).toBe(10); // never the same show twice
  });

  it('refuses rather than dealing a short board, and says how many it found', () => {
    const thin = [player('a', TEN.slice(0, 4)), player('b', TEN.slice(0, 4))];
    const { deck, enough, candidates } = buildDeck(thin);
    expect(enough).toBe(false);
    expect(deck).toEqual([]);
    expect(candidates).toBe(4); // the setup screen shows this
  });

  it('honours a smaller board size', () => {
    const { deck, enough } = buildDeck(two, { size: 5, rng: seeded(2) });
    expect(enough).toBe(true);
    expect(deck).toHaveLength(5);
  });

  it('deals the same order from the same seed, so a room can share one', () => {
    const a = buildDeck(two, { rng: seeded(7) }).deck;
    const b = buildDeck(two, { rng: seeded(7) }).deck;
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  it('does not deal the deck in year order — that would give the game away', () => {
    const { deck } = buildDeck(two, { rng: seeded(3) });
    const years = deck.map((s) => s.year);
    expect(years).not.toEqual([...years].sort((x, y) => x - y));
  });

  it('counts only shared shows when deciding there are enough', () => {
    // Ten shows each, but only three in common.
    const overlap = TEN.slice(0, 3);
    const thin = [
      player('a', [...overlap, ...TEN.slice(3, 7)]),
      player('b', [...overlap, anime('Frieren', 2023), anime('Dandadan', 2024)]),
    ];
    expect(buildDeck(thin).enough).toBe(false);
    expect(buildDeck(thin).candidates).toBe(3);
  });
});
