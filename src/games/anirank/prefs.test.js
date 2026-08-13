import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFS, resolveSavedAxis, axisIdOf } from './prefs';
import { DEFAULT_AXIS_ID, getAxis } from './axes';

const prompt = (id) => ({ id, custom: true, text: `prompt ${id}`, items: 'anime' });

describe('DEFAULT_PREFS', () => {
  // `blind` is the one default that is not free to be any value: a fresh setup
  // screen shows the default axis, and the box beside it has to match how that
  // axis actually deals. Retuning an axis's defaultBlind without this would leave
  // the screen contradicting itself, and the reset link lit on an untouched card.
  it('takes blind from the default axis rather than restating it', () => {
    expect(DEFAULT_PREFS.blind).toBe(getAxis(DEFAULT_AXIS_ID).defaultBlind);
  });

  it('covers every option the settings card can change', () => {
    expect(Object.keys(DEFAULT_PREFS).sort())
      .toEqual(['axisId', 'blind', 'format', 'scoring', 'sharedOnly']);
  });

  // mergePrefs backfills a missing key on the next read, so this default reaches
  // every player who has ever saved a setting. 'round' is what they already had.
  it('defaults format to the round every existing player was playing', () => {
    expect(DEFAULT_PREFS.format).toBe('round');
  });
});

describe('resolveSavedAxis', () => {
  it('passes a built-in id straight through', () => {
    expect(resolveSavedAxis('year', [])).toBe('year');
  });

  it('returns the stored prompt object for a custom id', () => {
    const mine = prompt('custom_1');
    expect(resolveSavedAxis('custom_1', [mine])).toBe(mine);
  });

  // The case getAxis cannot catch on its own: it resolves an unknown id to the
  // default silently, so the board would play "best" while the picker showed
  // nothing selected.
  it('falls back when the saved prompt has since been deleted', () => {
    expect(resolveSavedAxis('custom_gone', [prompt('custom_1')])).toBe(DEFAULT_AXIS_ID);
  });

  it('survives no saved id and no prompts', () => {
    expect(resolveSavedAxis(undefined, undefined)).toBe(DEFAULT_AXIS_ID);
  });
});

describe('axisIdOf', () => {
  it('reads the id off either shape a spec comes in', () => {
    expect(axisIdOf('year')).toBe('year');
    expect(axisIdOf(prompt('custom_1'))).toBe('custom_1');
  });

  it('falls back rather than returning undefined', () => {
    expect(axisIdOf(null)).toBe(DEFAULT_AXIS_ID);
  });
});
