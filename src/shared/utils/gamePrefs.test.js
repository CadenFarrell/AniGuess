import { describe, it, expect } from 'vitest';
import { mergePrefs, writePrefs, arePrefsDefault } from './gamePrefs';

// Stands in for a game's DEFAULT_PREFS: one of each type the real games use,
// including the array that makes === the wrong comparison.
const DEFAULTS = {
  sharedShowsOnly: true,
  talkMode: false,
  timerSeconds: 60,
  mode: 'race',
  pointsPerPosition: [3, 2, 1, 0],
};

describe('mergePrefs', () => {
  it('returns the defaults when nothing has been saved', () => {
    expect(mergePrefs(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(mergePrefs(undefined, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('lets a saved value win over its default', () => {
    const merged = mergePrefs({ timerSeconds: 90, talkMode: true }, DEFAULTS);
    expect(merged.timerSeconds).toBe(90);
    expect(merged.talkMode).toBe(true);
  });

  it('fills in an option added after the blob was written', () => {
    // No `mode` key at all — the build that saved this predates the mode picker.
    const merged = mergePrefs({ timerSeconds: 90 }, DEFAULTS);
    expect(merged.mode).toBe('race');
  });

  it('drops a key no longer in the defaults', () => {
    const merged = mergePrefs({ retiredOption: 'gone', talkMode: true }, DEFAULTS);
    expect(merged).not.toHaveProperty('retiredOption');
    expect(merged.talkMode).toBe(true);
  });

  it('rejects a value of the wrong type rather than handing it to a rule', () => {
    const merged = mergePrefs(
      { timerSeconds: '90', sharedShowsOnly: 'yes', mode: 7 },
      DEFAULTS
    );
    expect(merged.timerSeconds).toBe(60);
    expect(merged.sharedShowsOnly).toBe(true);
    expect(merged.mode).toBe('race');
  });

  it('does not accept an array where a scalar belongs, or the reverse', () => {
    // typeof [] is 'object', so a plain typeof check would let the first through.
    expect(mergePrefs({ timerSeconds: [90] }, DEFAULTS).timerSeconds).toBe(60);
    expect(mergePrefs({ pointsPerPosition: 3 }, DEFAULTS).pointsPerPosition).toEqual([3, 2, 1, 0]);
  });

  it('keeps a saved array', () => {
    expect(mergePrefs({ pointsPerPosition: [5, 3, 1, 0] }, DEFAULTS).pointsPerPosition)
      .toEqual([5, 3, 1, 0]);
  });

  it('survives a blob that is not an object', () => {
    expect(mergePrefs('corrupt', DEFAULTS)).toEqual(DEFAULTS);
    expect(mergePrefs([1, 2], DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe('writePrefs', () => {
  it('creates the slice when the game has never been saved', () => {
    expect(writePrefs({}, 'aniguess', { talkMode: true }, DEFAULTS))
      .toEqual({ aniguess: { talkMode: true } });
  });

  it('leaves other games alone', () => {
    const all = { anitune: { mode: 'simultaneous' } };
    const next = writePrefs(all, 'aniguess', { talkMode: true }, DEFAULTS);
    expect(next.anitune).toEqual({ mode: 'simultaneous' });
  });

  // The reason this merges instead of replacing. AniGuess's online lobby offers
  // three of the six options its local screen does, so a replacing write would
  // mean one online game wiping the timer settings chosen locally.
  it('preserves keys the saving screen does not offer', () => {
    const all = { aniguess: { timerEnabled: true, timerSeconds: 90, talkMode: true } };
    const next = writePrefs(all, 'aniguess', { sharedShowsOnly: false }, DEFAULTS);
    expect(next.aniguess).toEqual({
      timerEnabled: true,
      timerSeconds: 90,
      talkMode: true,
      sharedShowsOnly: false,
    });
  });

  it('overwrites a key the saving screen does offer', () => {
    const all = { aniguess: { timerSeconds: 90 } };
    expect(writePrefs(all, 'aniguess', { timerSeconds: 30 }, DEFAULTS).aniguess.timerSeconds)
      .toBe(30);
  });

  it('refuses a key outside the defaults and a value of the wrong type', () => {
    const next = writePrefs({}, 'aniguess', { nonsense: 1, timerSeconds: '30' }, DEFAULTS);
    expect(next.aniguess).toEqual({});
  });

  it('does not mutate the blob it was handed', () => {
    const all = { aniguess: { talkMode: false } };
    writePrefs(all, 'aniguess', { talkMode: true }, DEFAULTS);
    expect(all.aniguess.talkMode).toBe(false);
  });

  it('survives a blob that is not an object', () => {
    expect(writePrefs(null, 'aniguess', { talkMode: true }, DEFAULTS))
      .toEqual({ aniguess: { talkMode: true } });
  });
});

describe('arePrefsDefault', () => {
  it('is true for the defaults themselves', () => {
    expect(arePrefsDefault({ ...DEFAULTS }, DEFAULTS)).toBe(true);
  });

  it('notices a changed scalar', () => {
    expect(arePrefsDefault({ ...DEFAULTS, talkMode: true }, DEFAULTS)).toBe(false);
  });

  it('compares arrays by value, not identity', () => {
    expect(arePrefsDefault({ ...DEFAULTS, pointsPerPosition: [3, 2, 1, 0] }, DEFAULTS)).toBe(true);
    expect(arePrefsDefault({ ...DEFAULTS, pointsPerPosition: [5, 3, 1, 0] }, DEFAULTS)).toBe(false);
  });

  // An online lobby renders a subset of what its local twin does. Walking the
  // full defaults instead would find `undefined` for the missing option and
  // leave the reset link permanently lit on every lobby.
  it('judges a partial screen on the options it actually has', () => {
    expect(arePrefsDefault({ mode: 'race', timerSeconds: 60 }, DEFAULTS)).toBe(true);
    expect(arePrefsDefault({ mode: 'simultaneous' }, DEFAULTS)).toBe(false);
  });
});
