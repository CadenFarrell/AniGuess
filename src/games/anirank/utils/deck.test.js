import { describe, it, expect } from 'vitest';
import { eligibleItems, buildDeck } from './deck';
import { getAxis } from '../axes';

const YEAR = getAxis('year');
const RATED = getAxis('rated');
const FAVOURITES = getAxis('favourites');
const OPINION = getAxis('best');

// The shape mergeAnimeIntoProfile actually persists — { id, title, characters }
// plus the stats the import now carries. Fixtures that invent fields no writer
// produces are how the year axis shipped broken, so these mirror storage.
const anime = (title, year, over = {}) => ({
  id: `anilist_anime_${title}`,
  title,
  startDate: year == null ? null : { year, month: 4, day: 1 },
  coverImageUrl: `${title}.jpg`,
  characters: [],
  ...over,
});
const char = (name, favourites, over = {}) => ({
  id: `anilist_${name}`,
  name,
  role: 'Main',
  imageUrl: `${name}.png`,
  genres: [],
  ...(favourites == null ? {} : { favourites }),
  ...over,
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

describe('eligibleItems — shows', () => {
  it('keeps only shows every player has, since everyone ranks the same ten', () => {
    const out = eligibleItems([
      player('a', [anime('Bleach', 2004), anime('Naruto', 2002)]),
      player('b', [anime('Naruto', 2002), anime('Akira', 1988)]),
    ], { axis: YEAR });
    expect(out.map((s) => s.title)).toEqual(['Naruto']);
  });

  it('unions the lists when the shared toggle is off', () => {
    const out = eligibleItems([
      player('a', [anime('Bleach', 2004)]),
      player('b', [anime('Akira', 1988)]),
    ], { axis: YEAR, sharedOnly: false });
    expect(out.map((s) => s.title).sort()).toEqual(['Akira', 'Bleach']);
  });

  it('collapses a multi-season run into one entry, so four seasons are not four slots', () => {
    const out = eligibleItems([player('a', [
      anime('Attack on Titan', 2013),
      anime('Attack on Titan Season 2', 2017),
      anime('Attack on Titan: The Final Season', 2020),
    ])], { axis: YEAR, sharedOnly: false });
    expect(out).toHaveLength(1);
  });

  it('dates a franchise by its earliest season, the one people actually date', () => {
    const out = eligibleItems([player('a', [
      anime('Attack on Titan Season 2', 2017),
      anime('Attack on Titan', 2013),
    ])], { axis: YEAR, sharedOnly: false });
    expect(out[0].value).toBe(2013);
  });

  it('matches a franchise across players who saved different seasons of it', () => {
    const out = eligibleItems([
      player('a', [anime('Attack on Titan', 2013)]),
      player('b', [anime('Attack on Titan Season 2', 2017)]),
    ], { axis: YEAR });
    expect(out).toHaveLength(1);
    expect(out[0].value).toBe(2013);
  });

  it('drops shows with no air date, because there is nothing to rank them by', () => {
    const out = eligibleItems(
      [player('a', [anime('Bleach', 2004), anime('Mystery', null)])],
      { axis: YEAR, sharedOnly: false }
    );
    expect(out.map((s) => s.title)).toEqual(['Bleach']);
  });

  it('identifies a show by franchise key, so two spellings are one show', () => {
    const out = eligibleItems([player('a', [anime('Cowboy Bebop', 1998)])], {
      axis: YEAR, sharedOnly: false,
    });
    expect(out[0].id).toBeTruthy();
    expect(out[0]).toMatchObject({
      title: 'Cowboy Bebop', value: 1998, imageUrl: 'Cowboy Bebop.jpg',
    });
  });

  it('handles a player with no list, and an empty roster', () => {
    expect(eligibleItems([{ id: 'a' }, player('b', [anime('X', 2000)])], { axis: YEAR })).toEqual([]);
    expect(eligibleItems([], { axis: YEAR })).toEqual([]);
    expect(eligibleItems(null, { axis: YEAR })).toEqual([]);
  });
});

// Each fact axis reads a different field, and a profile imported before that
// field existed simply cannot play that mode — which the setup screen explains
// rather than showing a dead Start button.
describe('eligibleItems — per-axis eligibility', () => {
  it('drops shows missing the field THIS axis ranks by, keeping them for others', () => {
    const list = [
      anime('Bleach', 2004, { averageScore: 80 }),
      anime('Naruto', 2002), // dated, but never re-imported for scores
    ];
    const byYear = eligibleItems([player('a', list)], { axis: YEAR, sharedOnly: false });
    const byScore = eligibleItems([player('a', list)], { axis: RATED, sharedOnly: false });

    expect(byYear.map((s) => s.title).sort()).toEqual(['Bleach', 'Naruto']);
    expect(byScore.map((s) => s.title)).toEqual(['Bleach']);
  });

  it('keeps every show on an opinion axis, which needs no stats at all', () => {
    const out = eligibleItems([player('a', [anime('A', null), anime('B', null)])], {
      axis: OPINION, sharedOnly: false,
    });
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.value === null)).toBe(true);
  });
});

describe('eligibleItems — characters', () => {
  it('draws characters out of the shows on a list', () => {
    const out = eligibleItems([player('a', [
      anime('Bleach', 2004, { characters: [char('Ichigo', 900), char('Rukia', 800)] }),
    ])], { axis: FAVOURITES, sharedOnly: false });

    expect(out.map((c) => c.title).sort()).toEqual(['Ichigo', 'Rukia']);
  });

  it('is one card per person across seasons, not one per appearance', () => {
    const out = eligibleItems([player('a', [
      anime('Attack on Titan', 2013, { characters: [char('Eren', 500)] }),
      anime('Attack on Titan Season 2', 2017, { characters: [char('Eren', 900)] }),
    ])], { axis: FAVOURITES, sharedOnly: false });

    expect(out).toHaveLength(1);
    // The higher count wins — the one mergeCharacterEdges already settled on.
    expect(out[0].value).toBe(900);
  });

  it('folds diacritics, so one character spelled two ways is one card', () => {
    const out = eligibleItems([player('a', [
      anime('Show', 2000, { characters: [char('Rem', 100)] }),
      anime('Show Season 2', 2002, { characters: [char('rem', 100)] }),
    ])], { axis: FAVOURITES, sharedOnly: false });

    expect(out).toHaveLength(1);
  });

  it('names the show a character came from, for the card subtitle', () => {
    const out = eligibleItems([player('a', [
      anime('Bleach', 2004, { characters: [char('Ichigo', 900)] }),
    ])], { axis: FAVOURITES, sharedOnly: false });

    expect(out[0].subtitle).toBe('Bleach');
  });

  it('drops characters with no favourites count on the favourites axis', () => {
    const out = eligibleItems([player('a', [
      anime('Bleach', 2004, { characters: [char('Ichigo', 900), char('Nobody', null)] }),
    ])], { axis: FAVOURITES, sharedOnly: false });

    expect(out.map((c) => c.title)).toEqual(['Ichigo']);
  });

  it('keeps only characters every player has under sharedOnly', () => {
    const out = eligibleItems([
      player('a', [anime('Bleach', 2004, { characters: [char('Ichigo', 9), char('Rukia', 8)] })]),
      player('b', [anime('Bleach', 2004, { characters: [char('Ichigo', 9)] })]),
    ], { axis: FAVOURITES });

    expect(out.map((c) => c.title)).toEqual(['Ichigo']);
  });
});

describe('buildDeck', () => {
  const two = [player('a', TEN), player('b', TEN)];

  it('deals a full board from a big enough shared list', () => {
    const { deck, enough, candidates } = buildDeck(two, { axis: YEAR, rng: seeded(1) });
    expect(enough).toBe(true);
    expect(deck).toHaveLength(10);
    expect(candidates).toBe(10);
    expect(new Set(deck.map((s) => s.id)).size).toBe(10); // never the same show twice
  });

  it('refuses rather than dealing a short board, and says how many it found', () => {
    const thin = [player('a', TEN.slice(0, 4)), player('b', TEN.slice(0, 4))];
    const { deck, enough, candidates } = buildDeck(thin, { axis: YEAR });
    expect(enough).toBe(false);
    expect(deck).toEqual([]);
    expect(candidates).toBe(4); // the setup screen shows this
  });

  it('honours a smaller board size', () => {
    const { deck, enough } = buildDeck(two, { axis: YEAR, size: 5, rng: seeded(2) });
    expect(enough).toBe(true);
    expect(deck).toHaveLength(5);
  });

  it('deals the same order from the same seed, so a room can share one', () => {
    const a = buildDeck(two, { axis: YEAR, rng: seeded(7) }).deck;
    const b = buildDeck(two, { axis: YEAR, rng: seeded(7) }).deck;
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });

  it('does not deal the deck in value order — that would give the game away', () => {
    const { deck } = buildDeck(two, { axis: YEAR, rng: seeded(3) });
    const values = deck.map((s) => s.value);
    expect(values).not.toEqual([...values].sort((x, y) => x - y));
  });

  it('counts only shared shows when deciding there are enough', () => {
    // Ten shows each, but only three in common.
    const overlap = TEN.slice(0, 3);
    const thin = [
      player('a', [...overlap, ...TEN.slice(3, 7)]),
      player('b', [...overlap, anime('Frieren', 2023), anime('Dandadan', 2024)]),
    ];
    expect(buildDeck(thin, { axis: YEAR }).enough).toBe(false);
    expect(buildDeck(thin, { axis: YEAR }).candidates).toBe(3);
  });

  it('refuses a fact axis whose field nobody has imported yet', () => {
    // The ordinary state of a profile saved before the stats existed: plenty of
    // shows, none of them rankable by score.
    const { enough, candidates } = buildDeck(two, { axis: RATED });
    expect(enough).toBe(false);
    expect(candidates).toBe(0);
  });

  it('still deals the same shows on an opinion axis, with no values', () => {
    const { deck, enough } = buildDeck(two, { axis: OPINION, rng: seeded(4) });
    expect(enough).toBe(true);
    expect(deck).toHaveLength(10);
    expect(deck.every((s) => s.value === null)).toBe(true);
  });
});
