import { describe, it, expect } from 'vitest';
import {
  getEligibleAnimeList, eligibleEntries, hasSharedAnime, pickAudioForTheme, buildQuestionPool,
  shuffle, pickRound, yearRangeIsOpen, YEAR_MIN, YEAR_MAX,
} from './questionPool';

const player = (id, titles) => ({ id, animeList: titles.map((t) => ({ title: t })) });
// A list whose entries carry the stats a modern import stores.
const richPlayer = (id, entries) => ({ id, animeList: entries });
const show = (title, { popularity, year } = {}) => ({
  title,
  ...(popularity == null ? {} : { popularity }),
  ...(year == null ? {} : { startDate: { year, month: 4, day: 1 } }),
});

// A deterministic rng so the shuffle-dependent helpers are testable at all.
const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

describe('getEligibleAnimeList', () => {
  it('keeps only shows every player has, since everyone hears the same clip', () => {
    const players = [player('a', ['Bleach', 'Naruto']), player('b', ['Naruto', 'One Piece'])];
    expect(getEligibleAnimeList(players).map((a) => a.title)).toEqual(['Naruto']);
  });

  it('unions every list when the shared toggle is off', () => {
    const players = [player('a', ['Bleach']), player('b', ['Naruto'])];
    const out = getEligibleAnimeList(players, { sharedSongsOnly: false });
    expect(out.map((a) => a.title).sort()).toEqual(['Bleach', 'Naruto']);
  });

  it('matches shows across lists despite case and spacing differences', () => {
    const players = [player('a', ['Cowboy Bebop']), player('b', ['  cowboy bebop '])];
    expect(getEligibleAnimeList(players)).toHaveLength(1);
  });

  it('does not let one player listing a show twice stand in for everyone', () => {
    const players = [player('a', ['Naruto', 'naruto']), player('b', ['Bleach'])];
    expect(getEligibleAnimeList(players)).toEqual([]);
  });

  it('skips entries with no usable title', () => {
    const players = [{ id: 'a', animeList: [{ title: '' }, { title: 'Naruto' }] }, player('b', ['Naruto'])];
    expect(getEligibleAnimeList(players).map((a) => a.title)).toEqual(['Naruto']);
  });

  it('handles a player who has no list yet rather than throwing', () => {
    expect(getEligibleAnimeList([{ id: 'a' }, player('b', ['Naruto'])])).toEqual([]);
    expect(getEligibleAnimeList([{ id: 'a' }], { sharedSongsOnly: false })).toEqual([]);
  });

  it('returns nothing for an empty roster', () => {
    expect(getEligibleAnimeList([])).toEqual([]);
    expect(getEligibleAnimeList(null)).toEqual([]);
  });
});

describe('hasSharedAnime', () => {
  it('is what the UI uses to explain a disabled Start button', () => {
    expect(hasSharedAnime([player('a', ['Naruto']), player('b', ['Naruto'])])).toBe(true);
    expect(hasSharedAnime([player('a', ['Naruto']), player('b', ['Bleach'])])).toBe(false);
  });
});

describe('eligibleEntries — owners', () => {
  it('reports which players supplied each show', () => {
    const players = [player('a', ['Bleach', 'Naruto']), player('b', ['Naruto'])];
    const out = eligibleEntries(players, { sharedSongsOnly: false });
    expect(out.find((e) => e.anime.title === 'Naruto').owners.sort()).toEqual(['a', 'b']);
    expect(out.find((e) => e.anime.title === 'Bleach').owners).toEqual(['a']);
  });

  it('credits both players when they spelled the title differently', () => {
    const players = [player('a', ['Cowboy Bebop']), player('b', ['  cowboy bebop '])];
    expect(eligibleEntries(players)[0].owners.sort()).toEqual(['a', 'b']);
  });
});

describe('eligibleEntries — the year dial', () => {
  const players = () => [richPlayer('a', [
    show('Old', { year: 1998 }),
    show('New', { year: 2020 }),
    show('Undated'),
  ])];

  it('is open at the sentinel bounds', () => {
    expect(yearRangeIsOpen(YEAR_MIN, YEAR_MAX)).toBe(true);
    expect(yearRangeIsOpen(1990, YEAR_MAX)).toBe(false);
    expect(yearRangeIsOpen(YEAR_MIN, 2010)).toBe(false);
  });

  // While the dial is untouched a show with no stored date is perfectly
  // playable, and dropping it would quietly gut a pre-stats profile.
  it('keeps undated shows while the range is untouched', () => {
    const titles = getEligibleAnimeList(players(), { sharedSongsOnly: false }).map((a) => a.title);
    expect(titles.sort()).toEqual(['New', 'Old', 'Undated']);
  });

  it('drops what falls outside a narrowed range, undated shows included', () => {
    const titles = getEligibleAnimeList(players(), { sharedSongsOnly: false, yearFrom: 2010 })
      .map((a) => a.title);
    expect(titles).toEqual(['New']);
  });

  // AniList uses placeholder dates below 1900; treating one as a real year would
  // put a 2019 show in the 1800s.
  it('treats a placeholder date as undated', () => {
    const one = [richPlayer('a', [show('Bogus', { year: 1 })])];
    expect(getEligibleAnimeList(one, { sharedSongsOnly: false, yearFrom: 1990 })).toEqual([]);
  });
});

describe('eligibleEntries — the popularity dial', () => {
  const measured = [richPlayer('a', [
    show('Tiny', { popularity: 100 }),
    show('Mid', { popularity: 5000 }),
    show('Huge', { popularity: 900000 }),
    show('Bigger', { popularity: 400000 }),
  ])];

  // Nearest-rank, and the comparison is `>=` the quantile element, so "the more
  // popular half" of four keeps the median itself — the same inclusive rule
  // AniFake's fame floor uses.
  it('narrows a measured pool', () => {
    const titles = getEligibleAnimeList(measured, { sharedSongsOnly: false, popularity: 'known' })
      .map((a) => a.title);
    expect(titles.sort()).toEqual(['Bigger', 'Huge', 'Mid']);
    expect(getEligibleAnimeList(measured, { sharedSongsOnly: false, popularity: 'iconic' })
      .map((a) => a.title).sort()).toEqual(['Bigger', 'Huge']);
  });

  // The AniRank release-year bug, guarded at the level that matters: a profile
  // imported before the stats existed must play a normal round.
  it('leaves a pool it cannot measure completely alone', () => {
    const unmeasured = [richPlayer('a', [show('A'), show('B'), show('C')])];
    const titles = getEligibleAnimeList(unmeasured, { sharedSongsOnly: false, popularity: 'iconic' })
      .map((a) => a.title);
    expect(titles.sort()).toEqual(['A', 'B', 'C']);
  });

  it('keeps owners attached through the filter', () => {
    const two = [
      richPlayer('a', [
        show('Huge', { popularity: 900000 }),
        show('Tiny', { popularity: 1 }),
        show('Tinier', { popularity: 2 }),
        show('Tiniest', { popularity: 3 }),
      ]),
      richPlayer('b', [show('Huge', { popularity: 900000 })]),
    ];
    const out = eligibleEntries(two, { sharedSongsOnly: false, popularity: 'iconic' });
    // The filter really ran — the two least popular are gone...
    expect(out.map((e) => e.anime.title)).not.toContain('Tiny');
    // ...and the survivor still knows whose lists it came from.
    expect(out.find((e) => e.anime.title === 'Huge').owners.sort()).toEqual(['a', 'b']);
  });
});

describe('pickAudioForTheme', () => {
  const video = (link) => ({ audio: { link } });
  const entry = (props) => ({ version: 1, spoiler: false, nsfw: false, videos: [video('v1')], ...props });

  it('prefers the lowest version — the original cut', () => {
    const theme = { animethemeentries: [entry({ version: 3, videos: [video('v3')] }), entry({ version: 1, videos: [video('v1')] })] };
    expect(pickAudioForTheme(theme).link).toBe('v1');
  });

  it('treats a missing version as the original', () => {
    const theme = { animethemeentries: [entry({ version: 2, videos: [video('v2')] }), entry({ version: undefined, videos: [video('v?')] })] };
    expect(pickAudioForTheme(theme).link).toBe('v?');
  });

  // The flags describe the entry's VIDEO, and this game plays only audio — see
  // the long note on pickAudioForTheme. Measured over 71 real themes, filtering
  // on them dropped 8 to no song at all (Kill la Kill's "Sirius" among them) and
  // changed which audio file was picked in zero cases. It could only subtract.
  it('ignores the video-only spoiler and NSFW flags', () => {
    const theme = {
      animethemeentries: [
        entry({ spoiler: true, videos: [video('v1')] }),
        entry({ version: 2, videos: [video('v2')] }),
      ],
    };
    expect(pickAudioForTheme(theme).link).toBe('v1');
  });

  it('still yields a song when every entry is flagged', () => {
    const nsfw = { animethemeentries: [entry({ nsfw: true, spoiler: true, videos: [video('song')] })] };
    expect(pickAudioForTheme(nsfw).link).toBe('song');
  });

  it('falls through an entry whose videos carry no audio link', () => {
    const theme = { animethemeentries: [entry({ videos: [{ audio: {} }] }), entry({ version: 2, videos: [video('ok')] })] };
    expect(pickAudioForTheme(theme).link).toBe('ok');
  });

  it('returns null when there is nothing playable', () => {
    expect(pickAudioForTheme(null)).toBe(null);
    expect(pickAudioForTheme({})).toBe(null);
    expect(pickAudioForTheme({ animethemeentries: [] })).toBe(null);
  });
});

describe('buildQuestionPool', () => {
  const audioEntry = { version: 1, videos: [{ audio: { link: 'a.ogg' } }] };
  const resolved = (slug, name, year = 1998) => ({ slug, name, year });
  const theme = (type, slug, sequence = 1) => ({
    type, slug, sequence, song: { title: `${type} song` }, animethemeentries: [audioEntry],
  });

  const one = [{
    entry: { title: 'Cowboy Bebop' },
    resolved: resolved('cowboy-bebop', 'Cowboy Bebop'),
    themes: [theme('OP', 'OP1'), theme('ED', 'ED1')],
  }];

  it('judges the answer against the player\'s own title, not the romaji name', () => {
    const [q] = buildQuestionPool([{
      entry: { title: 'Attack on Titan' },
      resolved: resolved('shingeki-no-kyojin', 'Shingeki no Kyojin'),
      themes: [theme('OP', 'OP1')],
    }]);
    expect(q.animeTitle).toBe('Attack on Titan');
    expect(q.displayTitle).toBe('Shingeki no Kyojin');
  });

  it('honours the opening/ending toggles', () => {
    expect(buildQuestionPool(one).map((q) => q.type)).toEqual(['OP', 'ED']);
    expect(buildQuestionPool(one, { includeEndings: false }).map((q) => q.type)).toEqual(['OP']);
    expect(buildQuestionPool(one, { includeOpenings: false }).map((q) => q.type)).toEqual(['ED']);
  });

  it('skips anime that never resolved or have no themes', () => {
    expect(buildQuestionPool([{ entry: { title: 'X' }, resolved: null, themes: [theme('OP', 'OP1')] }])).toEqual([]);
    expect(buildQuestionPool([{ entry: { title: 'X' }, resolved: resolved('x', 'X'), themes: [] }])).toEqual([]);
  });

  it('skips a theme with no playable audio rather than emitting a dead question', () => {
    const noAudio = [{
      entry: { title: 'X' },
      resolved: resolved('x', 'X'),
      themes: [{ type: 'OP', slug: 'OP1', animethemeentries: [] }],
    }];
    expect(buildQuestionPool(noAudio)).toEqual([]);
  });

  it('gives each question an id unique to its anime and theme', () => {
    expect(buildQuestionPool(one).map((q) => q.id)).toEqual(['cowboy-bebop:OP1', 'cowboy-bebop:ED1']);
  });

  it('carries the reveal trivia through: artists, cover, year, owners', () => {
    const withExtras = [{
      entry: { title: 'Cowboy Bebop', coverImageUrl: 'cover.jpg' },
      resolved: resolved('cowboy-bebop', 'Cowboy Bebop', 1998),
      themes: [{
        type: 'OP',
        slug: 'OP1',
        sequence: 1,
        song: { title: 'Tank!', artists: [{ name: 'The Seatbelts' }, { name: 'Mai Yamane' }] },
        animethemeentries: [audioEntry],
      }],
      owners: ['ana', 'ben'],
    }];
    const [q] = buildQuestionPool(withExtras);
    expect(q.artists).toEqual(['The Seatbelts', 'Mai Yamane']);
    expect(q.coverImageUrl).toBe('cover.jpg');
    expect(q.year).toBe(1998);
    expect(q.owners).toEqual(['ana', 'ben']);
  });

  // A lot of older AnimeThemes entries have no artist rows at all; the reveal
  // renders this list, so it must be an array either way.
  it('gives a song with no credited artists an empty list, not null', () => {
    expect(buildQuestionPool(one)[0].artists).toEqual([]);
  });

  it('falls back to the profile’s own date when AnimeThemes has none', () => {
    const [q] = buildQuestionPool([{
      entry: { title: 'X', startDate: { year: 2007 } },
      resolved: { slug: 'x', name: 'X', year: null },
      themes: [theme('OP', 'OP1')],
    }]);
    expect(q.year).toBe(2007);
  });

  it('defaults owners to an empty list for callers that do not track them', () => {
    expect(buildQuestionPool(one)[0].owners).toEqual([]);
  });
});

describe('shuffle', () => {
  it('does not mutate its input', () => {
    const items = [1, 2, 3, 4, 5];
    shuffle(items, seeded(1));
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps every item exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(shuffle(items, seeded(7)).sort((a, b) => a - b)).toEqual(items);
  });

  it('deals the same order from the same seed, so a room can share one', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, seeded(42))).toEqual(shuffle(items, seeded(42)));
  });
});

describe('pickRound', () => {
  const q = (id, slug) => ({ id, slug });
  // One 25-theme show plus a handful of others — the case the cap exists for.
  const naruto = Array.from({ length: 25 }, (_, i) => q(`n${i}`, 'naruto'));
  const others = ['bleach', 'bebop', 'jjk', 'aot', 'onepiece'].map((s) => q(s, s));

  it('caps how many questions one anime contributes so a long series cannot swallow the round', () => {
    const round = pickRound([...naruto, ...others], { count: 5, maxPerAnime: 2, rng: seeded(3) });
    expect(round.filter((x) => x.slug === 'naruto')).toHaveLength(2);
    expect(round).toHaveLength(5);
  });

  it('tops up past the cap rather than returning a stunted round', () => {
    // Only Naruto available, so the cap of 2 cannot fill a round of 6.
    const round = pickRound(naruto, { count: 6, maxPerAnime: 2, rng: seeded(5) });
    expect(round).toHaveLength(6);
    expect(new Set(round.map((x) => x.id)).size).toBe(6); // and never repeats one
  });

  it('returns everything it has when the pool is smaller than the round', () => {
    expect(pickRound(others, { count: 10, rng: seeded(9) })).toHaveLength(others.length);
  });

  it('handles an empty pool', () => {
    expect(pickRound([], { count: 10 })).toEqual([]);
  });

  // Local play used to let ClipPlayer roll its own offset on every mount, so a
  // replay could land somewhere else and the sample-point setting had nowhere to
  // take effect. The clip is a property of the question now.
  it('stamps every question with a clip offset', () => {
    const round = pickRound(others, { count: 5, rng: seeded(11) });
    expect(round.every((x) => Number.isFinite(x.clipFraction))).toBe(true);
  });

  it('honours the sample point', () => {
    expect(pickRound(others, { count: 5, samplePoint: 'start', rng: seeded(1) })
      .every((x) => x.clipFraction === 0)).toBe(true);
    expect(pickRound(others, { count: 5, samplePoint: 'middle', rng: seeded(1) })
      .every((x) => x.clipFraction === 0.5)).toBe(true);
    // Random stays clear of the leading silence a theme usually opens with.
    expect(pickRound(others, { count: 5, samplePoint: 'random', rng: seeded(1) })
      .every((x) => x.clipFraction >= 0.2 && x.clipFraction <= 0.7)).toBe(true);
  });
});
