import { describe, it, expect } from 'vitest';
import { AXES, DEFAULT_AXIS_ID, getAxis, axesOfKind, promptFor, itemKey } from './axes';
import { trueOrder } from './rules';

describe('the axis registry', () => {
  it('gives every axis the fields the screens read off it', () => {
    for (const axis of AXES) {
      expect(axis.id, `${axis.id} id`).toBeTruthy();
      expect(['fact', 'opinion']).toContain(axis.kind);
      expect(['shows', 'characters']).toContain(axis.items);
      expect(axis.label, `${axis.id} label`).toBeTruthy();
      expect(axis.topLabel, `${axis.id} topLabel`).toBeTruthy();
      expect(axis.bottomLabel, `${axis.id} bottomLabel`).toBeTruthy();
      expect(axis.prompt, `${axis.id} prompt`).toBeTruthy();
      // Not toBeTruthy: `false` is a legitimate value here, and a missing field
      // would read as an open round rather than failing loudly.
      expect(typeof axis.defaultBlind, `${axis.id} defaultBlind`).toBe('boolean');
    }
  });

  // Facts are the mode where not knowing what is coming IS the game. Opinions
  // are not: the subject's board becomes the answer key everyone else is scored
  // against, so it has to be a considered ranking rather than an artifact of the
  // order the cards happened to arrive in.
  it('deals fact modes blind and opinion modes open by default', () => {
    for (const axis of axesOfKind('fact')) {
      expect(axis.defaultBlind, `${axis.id} defaultBlind`).toBe(true);
    }
    for (const axis of axesOfKind('opinion')) {
      expect(axis.defaultBlind, `${axis.id} defaultBlind`).toBe(false);
    }
  });

  // The test this file went without, and the reason the labels could drift: the
  // pair above only asserts the ends are *named*, so a flipped pair — the board
  // announcing OLDEST at the slot holding the newest show — passed the whole
  // suite. Nothing else tied a label to the direction rules.js actually sorts in.
  //
  // A "more" and a "less" item per fact axis, in the shape a saved profile
  // stores. Runs the real path — valueFor stamps the value, trueOrder sorts it —
  // so this catches a flipped comparator AND a valueFor that reads the wrong
  // field, which a hand-stamped deck would not.
  const MORE_AND_LESS = {
    year: [{ startDate: { year: 2022 } }, { startDate: { year: 1988 } }],
    rated: [{ averageScore: 88 }, { averageScore: 61 }],
    popular: [{ popularity: 500000 }, { popularity: 1200 }],
    length: [{ episodes: 148 }, { episodes: 12 }],
    favourites: [{ favourites: 40000 }, { favourites: 300 }],
  };

  it('puts the biggest value in the slot topLabel names', () => {
    for (const axis of axesOfKind('fact')) {
      // Before the destructure: a new fact axis with no fixture should fail
      // saying so, not with a TypeError from unpacking undefined.
      expect(MORE_AND_LESS[axis.id], `${axis.id} needs a fixture here`).toBeTruthy();
      const [more, less] = MORE_AND_LESS[axis.id];
      // Titles chosen so the alphabetical tie-break would put 'less' first —
      // if the values stopped deciding the order, this test notices.
      const deck = [
        { id: 'less', title: 'a less', value: axis.valueFor(less) },
        { id: 'more', title: 'b more', value: axis.valueFor(more) },
      ];
      expect(trueOrder(deck)[0].id, `${axis.id}: slot 1 holds ${axis.topLabel}`).toBe('more');
      expect(trueOrder(deck)[1].id, `${axis.id}: slot 2 holds ${axis.bottomLabel}`).toBe('less');
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
