import { describe, it, expect } from 'vitest';
import {
  profileIdFromName,
  countShows,
  countCharacters,
  summarizeProfiles,
  resolveActiveProfileId,
  profileFingerprint,
} from './profileStats';

const profile = (id, name, animeList = [], extra = {}) => ({ id, name, animeList, ...extra });
const show = (title, characterCount = 0) => ({
  id: title,
  title,
  characters: Array.from({ length: characterCount }, (_, i) => ({ name: `${title}-${i}` })),
});

describe('profileIdFromName', () => {
  it('folds case and surrounding whitespace to the same id', () => {
    expect(profileIdFromName('  Caden ')).toBe('caden');
    expect(profileIdFromName('CADEN')).toBe('caden');
  });

  it('collapses inner whitespace runs to a single underscore', () => {
    expect(profileIdFromName('Ada  Lovelace')).toBe('ada_lovelace');
  });

  it('does not fold a genuinely different name', () => {
    expect(profileIdFromName('Cadenn')).not.toBe(profileIdFromName('Caden'));
  });

  it('survives null and undefined rather than throwing', () => {
    expect(profileIdFromName(null)).toBe('');
    expect(profileIdFromName(undefined)).toBe('');
  });
});

describe('countShows / countCharacters', () => {
  it('counts across every show', () => {
    const p = profile('a', 'A', [show('Naruto', 3), show('Bleach', 2)]);
    expect(countShows(p)).toBe(2);
    expect(countCharacters(p)).toBe(5);
  });

  it('tolerates a profile missing animeList or characters', () => {
    expect(countShows({})).toBe(0);
    expect(countCharacters({})).toBe(0);
    expect(countCharacters({ animeList: [{ title: 'x' }] })).toBe(0);
  });
});

describe('profileFingerprint', () => {
  it('is stable across a fresh object with the same content', () => {
    // The provider hands out a new map (and new profile objects) on every save,
    // including saves to other profiles — the fingerprint must not see those.
    const a = profile('caden', 'Caden', [show('Naruto', 3)]);
    const b = profile('caden', 'Caden', [show('Naruto', 3)]);
    expect(profileFingerprint(a)).toBe(profileFingerprint(b));
  });

  it('changes when an import adds a show', () => {
    const before = profile('caden', 'Caden', [show('Naruto', 3)]);
    const after = profile('caden', 'Caden', [show('Naruto', 3), show('Bleach', 2)]);
    expect(profileFingerprint(after)).not.toBe(profileFingerprint(before));
  });

  it('changes when a re-import only adds characters to an existing show', () => {
    const before = profile('caden', 'Caden', [show('Naruto', 3)]);
    const after = profile('caden', 'Caden', [show('Naruto', 8)]);
    expect(profileFingerprint(after)).not.toBe(profileFingerprint(before));
  });

  it('changes when a re-import adds no characters but records new source ids', () => {
    // A newly aired season whose whole cast is filtered out still moves
    // anilistImportedIds, and the room copy should carry that forward.
    const before = profile('caden', 'Caden', [show('Naruto', 3)], { anilistImportedIds: [1] });
    const after = profile('caden', 'Caden', [show('Naruto', 3)], { anilistImportedIds: [1, 2] });
    expect(profileFingerprint(after)).not.toBe(profileFingerprint(before));
  });

  it('separates two different profiles that happen to hold the same list', () => {
    const mine = profile('caden', 'Caden', [show('Naruto', 3)]);
    const theirs = profile('alex', 'Alex', [show('Naruto', 3)]);
    expect(profileFingerprint(mine)).not.toBe(profileFingerprint(theirs));
  });

  it('survives null and a half-shaped profile rather than throwing', () => {
    expect(profileFingerprint(null)).toBe('');
    expect(() => profileFingerprint({})).not.toThrow();
  });
});

describe('summarizeProfiles', () => {
  it('puts the active profile first regardless of its other ranking', () => {
    const profiles = {
      a: profile('a', 'Zoe', [], { lastUsedAt: 500 }),
      b: profile('b', 'Alex', [], { lastUsedAt: 100 }),
    };
    expect(summarizeProfiles(profiles, 'b').map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('orders the rest by most recently used', () => {
    const profiles = {
      a: profile('a', 'Alex', [], { lastUsedAt: 100 }),
      b: profile('b', 'Bo', [], { lastUsedAt: 900 }),
    };
    expect(summarizeProfiles(profiles).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('breaks never-used ties on name so the order is stable', () => {
    const profiles = {
      z: profile('z', 'Zoe'),
      a: profile('a', 'Alex'),
      m: profile('m', 'Max'),
    };
    expect(summarizeProfiles(profiles).map((p) => p.name)).toEqual(['Alex', 'Max', 'Zoe']);
  });

  it('reports per-profile counts', () => {
    const profiles = { a: profile('a', 'Alex', [show('Naruto', 4)]) };
    expect(summarizeProfiles(profiles)[0]).toMatchObject({ shows: 1, characters: 4 });
  });

  it('returns an empty array for no profiles', () => {
    expect(summarizeProfiles({})).toEqual([]);
    expect(summarizeProfiles(null)).toEqual([]);
  });
});

describe('resolveActiveProfileId', () => {
  it('keeps a stored id that still exists', () => {
    const profiles = { a: profile('a', 'Alex'), b: profile('b', 'Bo') };
    expect(resolveActiveProfileId(profiles, 'b')).toBe('b');
  });

  it('falls back to the richest profile when the stored id is gone', () => {
    const profiles = {
      a: profile('a', 'Alex', [show('Naruto', 2)]),
      b: profile('b', 'Bo', [show('Bleach', 40)]),
    };
    expect(resolveActiveProfileId(profiles, 'deleted')).toBe('b');
  });

  it('falls back to the richest profile when nothing is stored', () => {
    const profiles = {
      a: profile('a', 'Alex', [show('Naruto', 2)]),
      b: profile('b', 'Bo', [show('Bleach', 40)]),
    };
    expect(resolveActiveProfileId(profiles, null)).toBe('b');
  });

  it('returns null when there are no profiles at all', () => {
    expect(resolveActiveProfileId({}, 'anything')).toBeNull();
  });
});
