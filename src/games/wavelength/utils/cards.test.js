import { describe, it, expect } from 'vitest';
import {
  BROWSE_SIZE, CARD_POOLS, MIN_CARD_POOL, SEARCH_LIMIT, browseCards, dealHand,
  eligibleCards, poolNoun, rankCards, searchableCards,
} from './cards';

// Two profiles that overlap on one show and one character, so every sharedOnly
// assertion below has something to actually share. The character fields are the
// ones an AniList import writes; the shows carry a coverImageUrl because the
// card renders it and the collapse rules prefer a copy that has one.
const CADEN = {
  id: 'caden',
  name: 'Caden',
  animeList: [
    {
      id: 1,
      title: 'Bocchi the Rock!',
      coverImageUrl: 'bocchi.jpg',
      characters: [
        { id: 'c1', name: 'Hitori Gotoh', imageUrl: 'bocchi-char.jpg' },
        { id: 'c2', name: 'Nijika Ijichi', imageUrl: '' },
      ],
    },
    {
      id: 2,
      title: 'Monster',
      coverImageUrl: 'monster.jpg',
      characters: [{ id: 'c3', name: 'Johan Liebert', imageUrl: 'johan.jpg' }],
    },
  ],
};

const GAVIN = {
  id: 'gavin',
  name: 'Gavin',
  animeList: [
    {
      id: 1,
      title: 'Bocchi the Rock!',
      coverImageUrl: 'bocchi.jpg',
      characters: [{ id: 'c1', name: 'Hitori Gotoh', imageUrl: 'bocchi-char.jpg' }],
    },
    {
      id: 9,
      title: 'Gintama',
      coverImageUrl: 'gintama.jpg',
      characters: [{ id: 'c9', name: 'Gintoki Sakata', imageUrl: 'gin.jpg' }],
    },
  ],
};

const titles = (cards) => cards.map((c) => c.title).sort();

describe('eligibleCards', () => {
  it('draws shows from one pool and characters from the other', () => {
    expect(titles(eligibleCards([CADEN], { pool: 'shows', sharedOnly: false })))
      .toEqual(['Bocchi the Rock!', 'Monster']);
    expect(titles(eligibleCards([CADEN], { pool: 'characters', sharedOnly: false })))
      .toEqual(['Hitori Gotoh', 'Johan Liebert', 'Nijika Ijichi']);
  });

  // A card only the psychic has seen is a guaranteed blind guess for everyone
  // else — and in readroom it is worse, since the table is being asked what the
  // psychic thinks about something they cannot picture.
  it('keeps only what everyone has when sharedOnly is on', () => {
    expect(titles(eligibleCards([CADEN, GAVIN], { pool: 'shows', sharedOnly: true })))
      .toEqual(['Bocchi the Rock!']);
    expect(titles(eligibleCards([CADEN, GAVIN], { pool: 'characters', sharedOnly: true })))
      .toEqual(['Hitori Gotoh']);
  });

  it('unions the lists when it is off', () => {
    expect(titles(eligibleCards([CADEN, GAVIN], { pool: 'shows', sharedOnly: false })))
      .toEqual(['Bocchi the Rock!', 'Gintama', 'Monster']);
  });

  // Inherited from deck.js rather than reimplemented — which is the entire
  // reason this module is a wrapper. If it ever stops holding, the wrapper has
  // silently become a fork.
  it('gives every card the four fields the renderer reads', () => {
    for (const pool of CARD_POOLS) {
      for (const card of eligibleCards([CADEN], { pool, sharedOnly: false })) {
        expect(card.id, `${pool} id`).toBeTruthy();
        expect(card.title, `${pool} title`).toBeTruthy();
        expect(typeof card.subtitle, `${pool} subtitle`).toBe('string');
        expect(typeof card.imageUrl, `${pool} imageUrl`).toBe('string');
      }
    }
  });

  it('names the series under a character, and nothing under a show', () => {
    const [bocchi] = eligibleCards([CADEN, GAVIN], { pool: 'characters', sharedOnly: true });
    expect(bocchi.subtitle).toBe('Bocchi the Rock!');
    const [show] = eligibleCards([CADEN, GAVIN], { pool: 'shows', sharedOnly: true });
    expect(show.subtitle).toBe('');
  });

  it('returns nothing for an empty table rather than throwing', () => {
    expect(eligibleCards([], { pool: 'shows' })).toEqual([]);
    expect(eligibleCards([{ id: 'x', name: 'X', animeList: [] }], { pool: 'shows' })).toEqual([]);
  });

  it('falls back to the character pool for an unknown pool name', () => {
    expect(titles(eligibleCards([CADEN], { pool: 'nonsense', sharedOnly: false })))
      .toEqual(titles(eligibleCards([CADEN], { pool: 'characters', sharedOnly: false })));
  });
});

describe('dealHand', () => {
  it('deals distinct cards, up to the size asked for', () => {
    const hand = dealHand([CADEN], { pool: 'characters', sharedOnly: false, size: 2 });
    expect(hand.length).toBe(2);
    expect(new Set(hand.map((c) => c.id)).size).toBe(2);
  });

  it('deals what it has when the pool is shorter than the hand', () => {
    const hand = dealHand([CADEN], { pool: 'shows', sharedOnly: false, size: 5 });
    expect(hand.length).toBe(2);
  });

  it('skips cards already played this session', () => {
    const all = eligibleCards([CADEN], { pool: 'characters', sharedOnly: false });
    const exclude = all.slice(0, 2).map((c) => c.id);
    const hand = dealHand([CADEN], { pool: 'characters', sharedOnly: false, size: 5, exclude });
    expect(hand.map((c) => c.id)).not.toContain(exclude[0]);
    expect(hand.map((c) => c.id)).not.toContain(exclude[1]);
  });

  // A repeat late in a long session beats a round that cannot start.
  it('repeats rather than dealing nothing once everything has been played', () => {
    const all = eligibleCards([CADEN], { pool: 'shows', sharedOnly: false });
    const hand = dealHand([CADEN], {
      pool: 'shows', sharedOnly: false, size: 1, exclude: all.map((c) => c.id),
    });
    expect(hand.length).toBe(1);
  });

  // `value` is deck.js's axis field — null on an opinion probe. It would ride
  // into RTDB meaning nothing, and normalizeRound would drop it anyway; not
  // writing it at all is one less shape to explain.
  it('carries only the four fields, never the axis value', () => {
    for (const card of dealHand([CADEN], { pool: 'characters', sharedOnly: false })) {
      expect(Object.keys(card).sort()).toEqual(['id', 'imageUrl', 'subtitle', 'title']);
    }
  });

  it('returns an empty hand for an empty table', () => {
    expect(dealHand([], { pool: 'shows' })).toEqual([]);
  });
});

describe('the pool gate', () => {
  // Two modes lean on this number for two different reasons — readroom deals one
  // card a round and would repeat itself, `cards` puts a search box in front of
  // it and a search over five things is just a list. Both want it comfortably
  // above the strip the empty search state shows.
  it('sets a floor the browse strip is a small fraction of', () => {
    expect(MIN_CARD_POOL).toBeGreaterThan(BROWSE_SIZE);
  });

  it('names both pools in the plural the banners print', () => {
    expect(poolNoun('shows')).toBe('shows');
    expect(poolNoun('characters')).toBe('characters');
    expect(poolNoun(undefined)).toBe('characters');
  });
});

// `cards` mode's replacement for the hand. Everything the psychic may search up,
// with this session's played cards taken out.
describe('searchableCards', () => {
  it('offers the same pool a hand would have been dealt from', () => {
    expect(titles(searchableCards([CADEN], { pool: 'characters', sharedOnly: false })))
      .toEqual(titles(eligibleCards([CADEN], { pool: 'characters', sharedOnly: false })));
  });

  // The whole reason this is a named function rather than two inline filters:
  // the local hook and the online one must not disagree about what "already
  // played" means, because a search that offers last round's card back reads at
  // the table as the game being broken.
  it('drops the cards this session has already played', () => {
    const all = searchableCards([CADEN], { pool: 'characters', sharedOnly: false });
    const played = [all[0].id];
    const left = searchableCards([CADEN], {
      pool: 'characters', sharedOnly: false, exclude: played,
    });
    expect(left.map((c) => c.id)).not.toContain(played[0]);
    expect(left).toHaveLength(all.length - 1);
  });

  // Unlike dealHand there is NO fallback to the unfiltered pool. An empty hand
  // is a round that cannot start; an empty search list is a round the psychic
  // plays the moment the pool widens, and quietly re-offering a played card is
  // the worse of the two.
  it('empties rather than re-offering everything once it runs out', () => {
    const all = searchableCards([CADEN], { pool: 'shows', sharedOnly: false });
    expect(searchableCards([CADEN], {
      pool: 'shows', sharedOnly: false, exclude: all.map((c) => c.id),
    })).toEqual([]);
  });

  it('honours sharedOnly, which is all that stops an unguessable pick', () => {
    expect(titles(searchableCards([CADEN, GAVIN], { pool: 'characters', sharedOnly: true })))
      .toEqual(['Hitori Gotoh']);
  });

  it('carries only the four fields a card renders', () => {
    for (const card of searchableCards([CADEN], { pool: 'characters', sharedOnly: false })) {
      expect(Object.keys(card).sort()).toEqual(['id', 'imageUrl', 'subtitle', 'title']);
    }
  });
});

// A thin adapter over shared/utils/guessSuggest, never a second ranker — so
// AniWave orders its matches identically to AniGuess and AniFake. These pin the
// MAPPING (title→name, subtitle→series, and the card handed back), not the
// ranking, which guessSuggest owns and tests.
describe('rankCards', () => {
  const POOL = searchableCards([CADEN], { pool: 'characters', sharedOnly: false });

  it('finds a card by its title', () => {
    expect(rankCards(POOL, 'johan').map((c) => c.title)).toEqual(['Johan Liebert']);
  });

  it('finds a character by the series in its subtitle', () => {
    expect(rankCards(POOL, 'bocchi').map((c) => c.title).sort())
      .toEqual(['Hitori Gotoh', 'Nijika Ijichi']);
  });

  // Diacritics are folded by the shared ranker; this is here because a card's
  // fields go through a rename on the way in and could arrive unfolded.
  it('matches through a fold, so nobody has to type an ō', () => {
    expect(rankCards(POOL, 'gotoh').map((c) => c.title)).toEqual(['Hitori Gotoh']);
  });

  it('hands back the card itself, not the row it was ranked as', () => {
    const [card] = rankCards(POOL, 'johan');
    expect(Object.keys(card).sort()).toEqual(['id', 'imageUrl', 'subtitle', 'title']);
  });

  // An empty box shows the browse strip instead — see PsychicView. A ranker that
  // returned everything here would render the whole shared list under the input.
  it('offers nothing for an empty query', () => {
    expect(rankCards(POOL, '')).toEqual([]);
    expect(rankCards(POOL, '   ')).toEqual([]);
  });

  it('survives an empty pool', () => {
    expect(rankCards([], 'johan')).toEqual([]);
    expect(rankCards(undefined, 'johan')).toEqual([]);
  });

  it('caps at SEARCH_LIMIT', () => {
    expect(SEARCH_LIMIT).toBeGreaterThan(0);
    expect(rankCards(POOL, 'i', 2).length).toBeLessThanOrEqual(2);
  });
});

// The search box's empty state. Not a hand: the psychic can search past it.
describe('browseCards', () => {
  it('takes its cards from the already-searchable pool', () => {
    const pool = searchableCards([CADEN], { pool: 'characters', sharedOnly: false });
    for (const card of browseCards(pool)) {
      expect(pool.map((c) => c.id)).toContain(card.id);
    }
  });

  it('shows what it has when the pool is shorter than the strip', () => {
    const pool = searchableCards([CADEN], { pool: 'shows', sharedOnly: false });
    expect(pool.length).toBeLessThan(BROWSE_SIZE);
    expect(browseCards(pool)).toHaveLength(pool.length);
  });

  it('survives an empty pool, which is a psychic with nothing to search', () => {
    expect(browseCards([])).toEqual([]);
    expect(browseCards(undefined)).toEqual([]);
  });
});
