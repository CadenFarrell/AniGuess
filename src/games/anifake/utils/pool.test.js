import { describe, it, expect } from 'vitest';
import {
  eligibleCharacters, fameFloor, famousCount, hasAnyFameData, hasFameSignal, hintFor,
  pickDecoy, pickSecret,
} from './pool';

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

  it('is a superset without sharedOnly, whatever the roster looks like', () => {
    // StealScreen's search box leans on exactly this. It offers the sharedOnly:
    // false list while the round may have been dealt from the narrowed one, so
    // if that were ever not a superset the caught fake could be handed a
    // dropdown that cannot express the right answer.
    const players = [
      player('p1', [{ title: 'S', characters: [char('Ann'), char('Bob')] }]),
      player('p2', [{ title: 'S', characters: [char('Ann'), char('Cid')] }]),
      player('p3', [{ title: 'T', characters: [char('Ann'), char('Bob'), char('Dee')] }]),
    ];
    const all = names(eligibleCharacters(players, { sharedOnly: false }));
    for (const name of names(eligibleCharacters(players))) {
      expect(all).toContain(name);
    }
    expect(all).toEqual(['Ann', 'Bob', 'Cid', 'Dee']);
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

  // Everything above runs on a pool carrying no `favourites` at all, which is
  // exactly what a profile imported before the stats landed looks like — so
  // those four cases are also the regression guard for the fame term degrading
  // to nothing rather than to zero cards. Below is the term itself.

  it('takes a famous supporting character over an unknown lead', () => {
    // The whole complaint the setting answers: a name people can actually say
    // something about beats a lead nobody remembers. `role` was only ever a
    // proxy for this, chosen because it survives an old import.
    //
    // The lead is the ONLY hintable lead here and would win outright on the old
    // ladder, so this cannot pass by accident.
    const mixed = [
      { id: 'lead', name: 'Lead', role: 'Main', genres: ['Action'], favourites: 1 },
      { id: 's1', name: 'S1', role: 'Supporting', genres: [], favourites: 5000 },
      { id: 's2', name: 'S2', role: 'Supporting', genres: [], favourites: 6000 },
      { id: 's3', name: 'S3', role: 'Supporting', genres: [], favourites: 7000 },
      { id: 's4', name: 'S4', role: 'Supporting', genres: [], favourites: 8000 },
    ];
    // Floor is the median of [1,5000,6000,7000,8000] → 6000, so the lead is out.
    expect(pickSecret(mixed, { fame: 'known', rng: () => 0 }).name).not.toBe('Lead');
    expect(pickSecret(mixed, { fame: 'known', rng: () => 0.99 }).name).not.toBe('Lead');
    // Off, and the old ladder decides again — the lead wins on genres alone.
    expect(pickSecret(mixed, { fame: 'any', rng: () => 0 }).name).toBe('Lead');
  });

  it('still prefers a lead and a hint inside the famous set', () => {
    const famous = [
      { id: 'a', name: 'A', role: 'Supporting', genres: [], favourites: 5000 },
      { id: 'b', name: 'B', role: 'Main', genres: ['Action'], favourites: 5000 },
    ];
    expect(pickSecret(famous, { fame: 'known', rng: () => 0 }).name).toBe('B');
  });

  it('draws across the whole top tier rather than down a stable list', () => {
    // The ladder is a max over a score now, not `.find` on an ordered array, so
    // a tier of two has to be reachable at both ends.
    const tied = [
      { id: 'a', name: 'A', role: 'Main', genres: ['Action'] },
      { id: 'b', name: 'B', role: 'Main', genres: ['Action'] },
    ];
    expect(pickSecret(tied, { rng: () => 0 }).name).toBe('A');
    expect(pickSecret(tied, { rng: () => 0.99 }).name).toBe('B');
  });

  it('deals from the whole pool when only a handful were ever measured', () => {
    // The regression this whole rule exists for. Two of ten entries carry a
    // count, so an ungated floor would score those two above everything and the
    // round would deal one of the same two every time — silently, since the
    // pool is technically full of eligible characters.
    const sparse = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, name: `C${i}`, role: 'Main', genres: ['Action'],
      favourites: i < 2 ? 5000 : 0,
    }));
    const drawn = new Set();
    for (let i = 0; i < 20; i += 1) {
      drawn.add(pickSecret(sparse, { fame: 'iconic', rng: () => i / 20 }).name);
    }
    // Every entry ties at the same score, so the draw spreads over all ten
    // rather than collapsing onto the two that happen to have been imported
    // more recently.
    expect(drawn.size).toBeGreaterThan(2);
    expect(drawn.has('C9')).toBe(true);
  });

  it('deals as it always did when the lists carry no popularity data', () => {
    // The AniRank release-year bug, avoided: a stat absent from older profiles
    // must mean "cannot answer", never "everybody scores zero and nothing is
    // eligible". Same pool, same result, whatever the setting says.
    expect(pickSecret(pool, { fame: 'iconic', rng: () => 0 }).name).toBe('D');
    expect(pickSecret(pool, { fame: 'known', rng: () => 0 }).name).toBe('D');
  });

  it('excludes what is already in someone’s hand, unless that is everything', () => {
    const two = [
      { id: 'a', name: 'A', role: 'Main', genres: ['Action'] },
      { id: 'b', name: 'B', role: 'Main', genres: ['Action'] },
    ];
    expect(pickSecret(two, { exclude: ['a'], rng: () => 0 }).name).toBe('B');
    // Refusing to deal is worse than repeating: a null secret strands the round
    // on "Waiting for the deal…" with nothing able to move it.
    expect(pickSecret([two[0]], { exclude: ['a'], rng: () => 0 }).name).toBe('A');
  });

  it('re-derives the fame floor from what is left after an exclusion', () => {
    // The floor has to come from what is actually drawable. Over the whole pool
    // the cut is 300, which would leave Mid as the only famous entry; over the
    // three that survive the exclusion it is 2, which admits Low as well — and
    // Low is first, so the two readings give different answers.
    const pooled = [
      { id: 'huge', name: 'Huge', role: 'Main', genres: ['Action'], favourites: 9000 },
      { id: 'low', name: 'Low', role: 'Main', genres: ['Action'], favourites: 2 },
      { id: 'tiny', name: 'Tiny', role: 'Main', genres: ['Action'], favourites: 1 },
      { id: 'mid', name: 'Mid', role: 'Main', genres: ['Action'], favourites: 300 },
    ];
    expect(pickSecret(pooled, { fame: 'iconic', exclude: ['huge'], rng: () => 0 }).name)
      .toBe('Low');
  });
});

describe('fameFloor / hasFameSignal', () => {
  const at = (...counts) => counts.map((n, i) => ({ id: `${i}`, favourites: n }));

  it('ranks only the entries that carry a count', () => {
    // THE detail the setting turns on. collapseCharacters writes
    // `favourites ?? 0`, so a pool half full of pre-stats entries has a median
    // of 0 — and `fav >= 0` would qualify literally everybody, making the
    // setting look like it did nothing.
    const half = at(0, 0, 0, 100, 200, 300);
    expect(fameFloor(half, 0.5)).toBe(200);
    // Not 0, which is what ranking the whole pool would have given.
    expect(fameFloor(half, 0)).toBe(100);
  });

  it('says it cannot answer rather than guessing', () => {
    expect(fameFloor(at(0, 0, 0), 0.5)).toBeNull();
    expect(fameFloor([{ id: 'x' }], 0.5)).toBeNull();
    expect(fameFloor([], 0.5)).toBeNull();
    // "Anyone" is an off switch, not a quantile of zero — the two differ on any
    // pool that does carry counts, per the case above.
    expect(fameFloor(at(100, 200), null)).toBeNull();
  });

  it('refuses to judge a pool on a measured handful', () => {
    // The failure this rule exists for: measure a fifth of the pool and the
    // quantile becomes a quantile of that fifth, so the round deals from two or
    // three characters forever — with nothing on screen saying why, because an
    // ungated hasFameSignal would report a signal.
    const sparse = [...at(0, 0, 0, 0, 0, 0, 0, 0), ...at(100, 900)];
    expect(fameFloor(sparse, 0.5)).toBeNull();
    expect(hasFameSignal(sparse)).toBe(false);

    // At the threshold it answers again — half measured is enough to describe
    // the pool rather than sample it.
    const half = [...at(0, 0), ...at(100, 900)];
    expect(fameFloor(half, 0.5)).toBe(100);
    expect(hasFameSignal(half)).toBe(true);
  });

  it('tells the two dead ends apart, because only one is worth importing for', () => {
    const none = at(0, 0, 0, 0);
    const sparse = [...at(0, 0, 0, 0, 0, 0, 0, 0), ...at(100, 900)];
    expect(hasAnyFameData(none)).toBe(false);
    expect(hasAnyFameData(sparse)).toBe(true);
    // Both are "the pick cannot use fame" — they differ only in the advice.
    expect(hasFameSignal(none)).toBe(false);
    expect(hasFameSignal(sparse)).toBe(false);
  });

  it('agrees with itself about what "no data" means', () => {
    expect(hasFameSignal(at(0, 0))).toBe(false);
    expect(hasFameSignal([])).toBe(false);
    expect(hasFameSignal(at(0, 5, 7))).toBe(true);
  });
});

describe('famousCount', () => {
  const entry = (favourites) => ({ id: `${favourites}`, role: 'Main', genres: [], favourites });

  it('is zero whenever the term is not narrowing anything', () => {
    const pool = [entry(1), entry(2), entry(3), entry(4)];
    expect(famousCount(pool, 'any')).toBe(0);
    // Cannot answer → not narrowing, so the screen shows no count rather than a
    // misleading one.
    expect(famousCount([entry(0), entry(0), entry(0), entry(9)], 'known')).toBe(0);
    expect(famousCount([], 'known')).toBe(0);
  });

  it('counts what is left above the floor, ties and all', () => {
    const pool = [entry(1), entry(2), entry(3), entry(4), entry(5)];
    // Floor is the median (3), and `>=` keeps it: 3, 4, 5.
    expect(famousCount(pool, 'known')).toBe(3);
    // A run of equal counts at the floor is NOT split — the setting can leave
    // more than its nominal fraction, which is exactly what the screen should
    // be reporting.
    const tied = [entry(1), entry(5), entry(5), entry(5), entry(5)];
    expect(famousCount(tied, 'iconic')).toBe(4);
  });

  it('narrows harder at iconic than at well-known', () => {
    const pool = Array.from({ length: 20 }, (_, i) => entry(i + 1));
    expect(famousCount(pool, 'iconic')).toBeLessThan(famousCount(pool, 'known'));
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

  it('keeps the re-deal off a character somebody was just holding', () => {
    expect(pickDecoy(pool, pool[2], { exclude: ['a'], rng: () => 0 }).name).toBe('B');
  });

  it('prefers a known decoy, so the fake is not caught for holding a nobody', () => {
    const showA = [
      { id: 'a', name: 'A', series: 'S', favourites: 1 },
      { id: 'b', name: 'B', series: 'S', favourites: 8000 },
      { id: 'c', name: 'C', series: 'S', favourites: 2 },
    ];
    expect(pickDecoy(showA, { id: 'z', series: 'S' }, { fame: 'known', rng: () => 0 }).name)
      .toBe('B');
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
