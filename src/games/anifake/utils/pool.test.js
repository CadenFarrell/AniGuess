import { describe, it, expect } from 'vitest';
import { eligibleCharacters, hintFor, pickDecoy, pickSecret } from './pool';

const seq = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

const char = (name, extra = {}) => ({
  id: `anilist_${name}`, name, role: 'Main', genres: ['Action'], ...extra,
});
const player = (id, animeList) => ({ id, name: id, animeList });

const names = (entries) => entries.map((e) => e.name).sort();

describe('eligibleCharacters', () => {
  it('keeps only characters every player has, under sharedOnly', () => {
    const players = [
      player('p1', [{ title: 'S', characters: [char('Ann'), char('Bob')] }]),
      player('p2', [{ title: 'S', characters: [char('Ann'), char('Cid')] }]),
    ];
    expect(names(eligibleCharacters(players))).toEqual(['Ann']);
    expect(names(eligibleCharacters(players, { sharedOnly: false })))
      .toEqual(['Ann', 'Bob', 'Cid']);
  });

  it('treats one person listed under several season titles as one character', () => {
    // The identity rule the whole app shares: folded name, never id — AniList
    // ids and ListManager's Date.now() ids have no common id space.
    const players = [
      player('p1', [
        { title: 'Show', characters: [char('Rem')] },
        { title: 'Show Season 2', characters: [{ ...char('Rém'), id: 'other' }] },
      ]),
    ];
    expect(eligibleCharacters(players)).toHaveLength(1);
  });

  it('collapses the ListManager `genre` shape without dropping the character', () => {
    // normalizeCharacter turns a singular `genre` string into a `genres` array;
    // both players hold the same character, arrived at from different sources.
    const players = [
      player('p1', [{ title: 'S', characters: [char('Ann', { genres: undefined, genre: 'Action' })] }]),
      player('p2', [{ title: 'S', characters: [char('Ann', { genres: ['Action'] })] }]),
    ];
    const [entry] = eligibleCharacters(players);
    expect(entry.name).toBe('Ann');
    expect(entry.genres).toEqual(['Action']);
  });

  it('carries genres onto the entry, because they are the fake’s whole hand', () => {
    const players = [player('p1', [{ title: 'S', characters: [char('Ann', { genres: ['Romance'] })] }])];
    expect(eligibleCharacters(players)[0].genres).toEqual(['Romance']);
  });

  it('keeps the copy that has genres when one player’s copy has none', () => {
    // A blank copy winning here deals the fake nothing, which is the failure
    // this tiebreak exists to stop.
    const players = [
      player('p1', [{ title: 'S', characters: [char('Ann', { genres: [] })] }]),
      player('p2', [{ title: 'S', characters: [char('Ann', { genres: ['Drama'] })] }]),
    ];
    expect(eligibleCharacters(players)[0].genres).toEqual(['Drama']);
  });

  it('prefers a copy with a portrait over one with more favourites', () => {
    const players = [
      player('p1', [{ title: 'S', characters: [char('Ann', { imageUrl: '', favourites: 900 })] }]),
      player('p2', [{ title: 'S', characters: [char('Ann', { imageUrl: 'pic', favourites: 1 })] }]),
    ];
    expect(eligibleCharacters(players)[0].imageUrl).toBe('pic');
  });

  it('gives nothing for no players and skips a character with no usable name', () => {
    expect(eligibleCharacters([])).toEqual([]);
    expect(eligibleCharacters(undefined)).toEqual([]);
    const players = [player('p1', [{ title: 'S', characters: [{ id: 'x', name: '  ' }] }])];
    expect(eligibleCharacters(players)).toEqual([]);
  });
});

describe('pickSecret', () => {
  const pool = [
    { id: 'a', name: 'A', role: 'Supporting', genres: [] },
    { id: 'b', name: 'B', role: 'Supporting', genres: ['Action'] },
    { id: 'c', name: 'C', role: 'Main', genres: [] },
    { id: 'd', name: 'D', role: 'Main', genres: ['Action'] },
  ];

  it('takes a lead with genres over everything else', () => {
    // rng: 0 into the top tier, which holds only D.
    expect(pickSecret(pool, { rng: () => 0 }).name).toBe('D');
  });

  it('falls back a tier at a time rather than refusing to deal', () => {
    // A lead with no genres beats a supporting character with them: an unknown
    // face makes every clue meaningless, which is worse than a missing hint.
    expect(pickSecret(pool.filter((c) => c.name !== 'D'), { rng: () => 0 }).name).toBe('C');
    // No leads at all — the hintable supporting character wins.
    expect(pickSecret([pool[0], pool[1]], { rng: () => 0 }).name).toBe('B');
    // Nothing qualifies on either count, so it still deals.
    expect(pickSecret([pool[0]], { rng: () => 0 }).name).toBe('A');
  });

  it('gives nothing for an empty pool', () => {
    expect(pickSecret([], { rng: () => 0 })).toBeNull();
    expect(pickSecret(undefined)).toBeNull();
  });
});

describe('pickDecoy', () => {
  const pool = [
    { id: 'a', name: 'A', series: 'Show A' },
    { id: 'b', name: 'B', series: 'Show A' },
    { id: 'c', name: 'C', series: 'Show B' },
  ];

  it('draws from the same show, so the fake’s clues land in the right area', () => {
    // rng 0.99 would pick the last of the whole pool; the same-show tier holds
    // only B, so it pins there.
    expect(pickDecoy(pool, pool[0], { rng: () => 0.99 }).name).toBe('B');
  });

  it('falls back to anyone else when the secret is alone in its show', () => {
    const decoy = pickDecoy(pool, pool[2], { rng: () => 0 });
    expect(decoy.name).not.toBe('C');
    expect(decoy).not.toBeNull();
  });

  it('gives nothing when the pool holds only the secret — why decoy needs two', () => {
    expect(pickDecoy([pool[0]], pool[0], { rng: () => 0 })).toBeNull();
    expect(pickDecoy([], pool[0])).toBeNull();
  });
});

describe('hintFor', () => {
  it('picks one genre off the character', () => {
    const entry = { genres: ['Action', 'Romance', 'Comedy'] };
    expect(hintFor(entry, { rng: seq(0.5) })).toBe('Romance');
    expect(hintFor(entry, { rng: seq(0) })).toBe('Action');
  });

  it('returns null rather than a filler word when there is nothing on file', () => {
    // A fabricated hint sends the fake somewhere the clues will never go, which
    // reads as the game lying to them. The screen says "no hint" instead.
    expect(hintFor({ genres: [] })).toBeNull();
    expect(hintFor({})).toBeNull();
    expect(hintFor(null)).toBeNull();
  });
});
