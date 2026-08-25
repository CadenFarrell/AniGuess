import { describe, it, expect } from 'vitest';
import {
  validateFact, normalizePack, indexPack, factsFor, allSubjectKeys, factCount,
  subjectKeyForShow, subjectKeyForCharacter,
} from './facts';

const showRow = (field, value, key = 'attack on titan') => ({ kind: 'show', key, field, value });

const PACK = {
  version: 1,
  shows: {
    'attack on titan': {
      anilistId: 16498,
      title: 'Attack on Titan',
      studio: 'WIT STUDIO',
      director: 'Tetsuro Araki',
      seasonYear: 2013,
    },
    'cowboy bebop': {
      anilistId: 1,
      title: 'Cowboy Bebop',
      studio: 'Sunrise',
      seasonYear: 1998,
    },
  },
  characters: {
    levi: { anilistId: 45627, name: 'Levi', voiceActorJp: 'Hiroshi Kamiya', appearsIn: ['attack on titan'] },
  },
};

describe('validateFact', () => {
  it('accepts a well-formed row', () => {
    expect(validateFact(showRow('studio', 'WIT STUDIO')).ok).toBe(true);
  });

  // The three ways a source adapter degrades quietly. Each has to be caught
  // here, because the generator's only other option is shipping it.
  it('rejects a field that is not in the schema', () => {
    const result = validateFact(showRow('animationStudio', 'WIT STUDIO'));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown field/);
  });

  it('rejects an empty string, which is not an answer to anything', () => {
    expect(validateFact(showRow('studio', '   ')).ok).toBe(false);
  });

  it('rejects an out-of-range year', () => {
    expect(validateFact(showRow('seasonYear', 2013)).ok).toBe(true);
    expect(validateFact(showRow('seasonYear', 12013)).ok).toBe(false);
    expect(validateFact(showRow('seasonYear', 1899)).ok).toBe(false);
  });

  it('rejects a character field asserted about a show', () => {
    const result = validateFact(showRow('voiceActorJp', 'Hiroshi Kamiya'));
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/belongs to character/);
  });

  it('rejects a null value rather than storing "we do not know" as a fact', () => {
    expect(validateFact(showRow('studio', null)).ok).toBe(false);
  });

  it('rejects an empty subject key', () => {
    expect(validateFact(showRow('studio', 'Sunrise', '')).ok).toBe(false);
  });

  it('rejects a list field given a bare string', () => {
    expect(validateFact(showRow('genres', 'Action')).ok).toBe(false);
    expect(validateFact(showRow('genres', ['Action', 'Drama'])).ok).toBe(true);
    expect(validateFact(showRow('genres', [])).ok).toBe(false);
  });
});

describe('normalizePack', () => {
  it('drops unknown fields and invalid values but keeps the rest of the entry', () => {
    const pack = normalizePack({
      version: 1,
      shows: { 'cowboy bebop': { title: 'Cowboy Bebop', studio: 'Sunrise', vibes: 'jazzy', episodes: 0 } },
    });
    expect(pack.shows['cowboy bebop']).toEqual({ title: 'Cowboy Bebop', studio: 'Sunrise' });
  });

  it('drops an entry that carries no facts at all', () => {
    const pack = normalizePack({ shows: { 'cowboy bebop': { title: 'Cowboy Bebop', anilistId: 1 } } });
    expect(pack.shows).toEqual({});
  });

  it('survives missing sections and a garbage payload', () => {
    expect(normalizePack(null)).toEqual({ version: 0, shows: {}, characters: {} });
    expect(normalizePack({ shows: 'nope' }).shows).toEqual({});
  });
});

describe('factsFor', () => {
  const index = indexPack(PACK);

  it('returns only the subjects asked for', () => {
    const found = factsFor(index, ['attack on titan']);
    expect(found).toHaveLength(1);
    expect(found[0].studio).toBe('WIT STUDIO');
  });

  // The fail-open bug: an empty key set must not mean "everything". That would
  // silently turn a shared-list draw into a global one for exactly the rooms
  // whose lists failed to load — the one case nobody would think to test by hand.
  it('returns nothing for an empty key set rather than everything', () => {
    expect(factsFor(index, [])).toEqual([]);
    expect(allSubjectKeys(index)).toHaveLength(2);
  });

  it('ignores keys the pack has never heard of, and duplicates', () => {
    const found = factsFor(index, ['attack on titan', 'attack on titan', 'some ova nobody has']);
    expect(found.map((f) => f.key)).toEqual(['attack on titan']);
  });

  it('reads characters from their own section', () => {
    expect(factsFor(index, ['levi'], 'character')[0].voiceActorJp).toBe('Hiroshi Kamiya');
    // A character key must not resolve against the show map.
    expect(factsFor(index, ['levi'])).toEqual([]);
  });
});

// The single assumption the whole targeting design rests on: a pack key is the
// same fold a saved profile produces, so a season-marked title in somebody's
// list still finds the franchise row. If these two ever drift, every clue
// silently stops matching the shows the table actually owns.
describe('pack keys match the folds a profile keys on', () => {
  const index = indexPack(PACK);

  it('finds the franchise row from a season-marked title', () => {
    for (const title of [
      'Attack on Titan',
      'Attack on Titan Season 2',
      'Attack on Titan: The Final Season',
      'ATTACK ON TITAN S2',
    ]) {
      expect(subjectKeyForShow(title)).toBe('attack on titan');
      expect(factsFor(index, [subjectKeyForShow(title)])).toHaveLength(1);
    }
  });

  it('folds diacritics in a character name the way a profile does', () => {
    expect(subjectKeyForCharacter('Levi')).toBe('levi');
    expect(subjectKeyForCharacter('Rem')).toBe(subjectKeyForCharacter('  REM '));
    expect(subjectKeyForCharacter('Rōshi')).toBe(subjectKeyForCharacter('Roshi'));
  });
});

describe('factCount', () => {
  it('counts facts, not identifying fields', () => {
    expect(factCount({ anilistId: 1, title: 'Cowboy Bebop', studio: 'Sunrise', seasonYear: 1998 })).toBe(2);
    expect(factCount(null)).toBe(0);
  });
});
