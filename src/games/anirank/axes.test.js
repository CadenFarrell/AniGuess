import { describe, it, expect } from 'vitest';
import { AXES, DEFAULT_AXIS_ID, getAxis, axesOfKind, promptFor, itemKey } from './axes';

describe('the axis registry', () => {
  it('gives every axis the fields the screens read off it', () => {
    for (const axis of AXES) {
      expect(axis.id, `${axis.id} id`).toBeTruthy();
      expect(['fact', 'opinion']).toContain(axis.kind);
      expect(['shows', 'characters']).toContain(axis.items);
      expect(axis.label, `${axis.id} label`).toBeTruthy();
      expect(axis.lowLabel, `${axis.id} lowLabel`).toBeTruthy();
      expect(axis.highLabel, `${axis.id} highLabel`).toBeTruthy();
      expect(axis.prompt, `${axis.id} prompt`).toBeTruthy();
    }
  });

  it('has no duplicate ids, which would make getAxis ambiguous', () => {
    expect(new Set(AXES.map((a) => a.id)).size).toBe(AXES.length);
  });

  // The two halves of the contract rules.js relies on: a fact axis can always
  // produce a number, an opinion axis never claims to.
  it('gives every fact axis a valueFor and a format, and no opinion axis one', () => {
    for (const axis of axesOfKind('fact')) {
      expect(typeof axis.valueFor, `${axis.id} valueFor`).toBe('function');
      expect(typeof axis.format, `${axis.id} format`).toBe('function');
    }
    for (const axis of axesOfKind('opinion')) {
      expect(axis.valueFor, `${axis.id} valueFor`).toBeUndefined();
    }
  });

  it('returns null from valueFor when the field was never imported', () => {
    for (const axis of axesOfKind('fact')) {
      expect(axis.valueFor({}), `${axis.id} on a bare entry`).toBe(null);
      expect(axis.valueFor(null), `${axis.id} on nothing`).toBe(null);
    }
  });

  it('reads the year off the startDate a saved profile carries', () => {
    const year = getAxis('year');
    expect(year.valueFor({ startDate: { year: 1998 } })).toBe(1998);
    // AniList placeholder dates are not real air years.
    expect(year.valueFor({ startDate: { year: 0 } })).toBe(null);
    expect(year.valueFor({ startDate: {} })).toBe(null);
  });
});

describe('getAxis', () => {
  it('finds an axis by id', () => {
    expect(getAxis('year').id).toBe('year');
  });

  // A room written by an older build can name an axis this one dropped, and a
  // round that cannot name its axis would render a blank board.
  it('falls back to the default rather than returning nothing', () => {
    expect(getAxis('no-such-axis').id).toBe(DEFAULT_AXIS_ID);
    expect(getAxis(undefined).id).toBe(DEFAULT_AXIS_ID);
    expect(getAxis(null).id).toBe(DEFAULT_AXIS_ID);
  });
});

describe('promptFor', () => {
  it('names the subject in an opinion prompt', () => {
    expect(promptFor(getAxis('best'), 'Caden')).toContain('Caden');
  });

  it('returns a fact prompt unchanged, so callers never branch', () => {
    expect(promptFor(getAxis('year'), 'Caden')).toBe(getAxis('year').prompt);
  });

  it('accepts a bare axis id as well as an axis', () => {
    expect(promptFor('best', 'Caden')).toContain('Caden');
  });
});

describe('itemKey', () => {
  it('identifies a character by folded name, not by id', () => {
    expect(itemKey(getAxis('favourites'), { id: 'anilist_1', name: 'Rem' }))
      .toBe(itemKey(getAxis('favourites'), { id: 'anilist_2', name: 'rem' }));
  });

  it('identifies a show by its franchise id', () => {
    expect(itemKey(getAxis('year'), { id: 'cowboy bebop' })).toBe('cowboy bebop');
  });
});
