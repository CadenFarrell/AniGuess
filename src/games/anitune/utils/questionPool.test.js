import { describe, it, expect } from 'vitest';
import {
  getEligibleAnimeList, hasSharedAnime, pickAudioForTheme, buildQuestionPool, shuffle, pickRound,
} from './questionPool';

const player = (id, titles) => ({ id, animeList: titles.map((t) => ({ title: t })) });

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

  it('skips spoiler and NSFW entries, because a quiz shows these unprompted', () => {
    const theme = { animethemeentries: [entry({ spoiler: true, videos: [video('spoil')] }), entry({ version: 2, videos: [video('safe')] })] };
    expect(pickAudioForTheme(theme).link).toBe('safe');

    const nsfw = { animethemeentries: [entry({ nsfw: true, videos: [video('nsfw')] })] };
    expect(pickAudioForTheme(nsfw)).toBe(null);
  });

  it('allows them back in when explicitly asked', () => {
    const theme = { animethemeentries: [entry({ spoiler: true, videos: [video('spoil')] })] };
    expect(pickAudioForTheme(theme, { allowSpoilers: true }).link).toBe('spoil');
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
});
