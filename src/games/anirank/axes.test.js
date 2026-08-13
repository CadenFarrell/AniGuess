import { describe, it, expect } from 'vitest';
import {
  AXES, DEFAULT_AXIS_ID, MAX_END_LABEL_LEN, MAX_PROMPT_LEN,
  axesOfKind, axisForPool, customAxis, getAxis, isCustom, itemKey, needsEndLabels,
  normalizeCustomPrompt, promptFor,
} from './axes';
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
    // `custom: true` with nothing to hydrate from — a truncated write, or an
    // entry that lost its text. Still has to name a mode.
    expect(getAxis({ custom: true }).id).toBe(DEFAULT_AXIS_ID);
  });

  // The three shapes a spec arrives in. Callers pass whichever they are holding
  // rather than tracking which one it is, which is the point of the polymorphism.
  it('accepts an id, a saved prompt, an already-resolved axis, or an { id }', () => {
    const saved = normalizeCustomPrompt({ text: 'best dressed' });
    expect(getAxis('year').id).toBe('year');
    expect(getAxis(saved).label).toBe('Best dressed');
    expect(getAxis(getAxis('year'))).toBe(getAxis('year'));
    expect(getAxis({ id: 'year' }).id).toBe('year');
    // Idempotent on a hydrated custom axis too: it keeps its `text`, so it is
    // still a valid spec.
    expect(getAxis(getAxis(saved)).label).toBe('Best dressed');
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

describe('custom prompts', () => {
  const SAVED = normalizeCustomPrompt({
    text: 'most likely to steal your food',
    items: 'characters',
  });

  // The same contract the registry loop above asserts for every shipped axis.
  // A hydrated prompt goes to exactly the same screens, so it has to satisfy it
  // or the board renders with a missing end label or an unnamed mode.
  it('hydrates into an axis the screens can read', () => {
    const axis = customAxis(SAVED);
    expect(axis.id).toBeTruthy();
    expect(axis.label).toBeTruthy();
    expect(axis.topLabel).toBeTruthy();
    expect(axis.bottomLabel).toBeTruthy();
    expect(axis.prompt).toBeTruthy();
    expect(typeof axis.defaultBlind).toBe('boolean');
    expect(['fact', 'opinion']).toContain(axis.kind);
    expect(['shows', 'characters']).toContain(axis.items);
  });

  // The half of the contract deck.js relies on: no valueFor means the value
  // filter is skipped and every show or character is eligible. A custom prompt
  // that claimed one would deal an empty deck.
  it('is an opinion axis with no valueFor, dealt open', () => {
    const axis = customAxis(SAVED);
    expect(axis.kind).toBe('opinion');
    expect(axis.valueFor).toBeUndefined();
    expect(axis.defaultBlind).toBe(false);
    expect(isCustom(axis)).toBe(true);
    expect(isCustom(getAxis('best'))).toBe(false);
  });

  it('frames the typed clause as a prompt about the subject', () => {
    const line = promptFor(customAxis(SAVED), 'Caden');
    expect(line).toContain('most likely to steal your food');
    expect(line).toContain('Caden');
    // The noun follows `items`, so the sentence reads about the pool actually
    // being dealt rather than always saying "shows".
    expect(line).toContain('characters');
  });

  // The online path in one assertion. The prompt is a FUNCTION, which cannot
  // survive JSON — so what crosses RTDB is the stored shape, and every guest
  // rebuilds the axis from it. Get this wrong and the host's prompt silently
  // becomes Best → Worst on every other device in the room.
  it('survives a JSON round-trip, which is how it reaches other devices', () => {
    const overWire = JSON.parse(JSON.stringify(SAVED));
    const there = getAxis(overWire);
    const here = customAxis(SAVED);
    expect(there.id).toBe(here.id);
    expect(there.label).toBe(here.label);
    expect(there.topLabel).toBe(here.topLabel);
    expect(there.items).toBe(here.items);
    expect(promptFor(there, 'Caden')).toBe(promptFor(here, 'Caden'));
  });

  it('resolves through itemKey the same way a built-in of that pool does', () => {
    expect(itemKey(customAxis(SAVED), { id: 'anilist_1', name: 'Rem' }))
      .toBe(itemKey(getAxis('favourites'), { id: 'anilist_2', name: 'rem' }));
  });
});

describe('normalizeCustomPrompt', () => {
  it('trims, collapses whitespace and truncates the prompt', () => {
    expect(normalizeCustomPrompt({ text: '  most   likely  to win ' }).text)
      .toBe('most likely to win');
    expect(normalizeCustomPrompt({ text: 'x'.repeat(200) }).text)
      .toHaveLength(MAX_PROMPT_LEN);
  });

  // The ends are rendered verbatim beside built-in labels that are all caps, and
  // a blank one would leave the board with an unnamed end.
  it('uppercases and truncates the end labels, defaulting when blank', () => {
    const p = normalizeCustomPrompt({ text: 'a', topLabel: ' guilty ', bottomLabel: '' });
    expect(p.topLabel).toBe('GUILTY');
    expect(p.bottomLabel).toBe('LEAST');
    expect(normalizeCustomPrompt({ text: 'a' }).topLabel).toBe('MOST');
    expect(normalizeCustomPrompt({ text: 'a', topLabel: 'y'.repeat(50) }).topLabel)
      .toHaveLength(MAX_END_LABEL_LEN);
  });

  it('coerces items to one of the two pools', () => {
    expect(normalizeCustomPrompt({ text: 'a', items: 'characters' }).items).toBe('characters');
    expect(normalizeCustomPrompt({ text: 'a', items: 'nonsense' }).items).toBe('shows');
    expect(normalizeCustomPrompt({ text: 'a' }).items).toBe('shows');
  });

  // Runs on read as well as write, so this is what drops a junk saved entry
  // rather than listing a nameless mode that renders a blank board.
  it('returns null when there is no prompt left to save', () => {
    expect(normalizeCustomPrompt({ text: '   ' })).toBe(null);
    expect(normalizeCustomPrompt({})).toBe(null);
    expect(normalizeCustomPrompt(null)).toBe(null);
  });

  it('keeps an existing id, so editing updates rather than duplicates', () => {
    expect(normalizeCustomPrompt({ id: 'custom_abc', text: 'a' }).id).toBe('custom_abc');
    expect(normalizeCustomPrompt({ text: 'a' }).id).toMatch(/^custom_/);
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

describe('axisForPool', () => {
  // The move behind the Shows/Characters toggle. Kind is preserved on purpose:
  // flipping pools must not also flip you from a factual question to an opinion.
  it('keeps the kind and swaps the pool', () => {
    expect(getAxis(axisForPool('best', 'characters'))).toMatchObject({ kind: 'opinion', items: 'characters' });
    expect(getAxis(axisForPool('year', 'characters'))).toMatchObject({ kind: 'fact', items: 'characters' });
    expect(getAxis(axisForPool('favourites', 'shows'))).toMatchObject({ kind: 'fact', items: 'shows' });
    expect(getAxis(axisForPool('fight', 'shows'))).toMatchObject({ kind: 'opinion', items: 'shows' });
  });

  // Untouched rather than re-picked, so tapping the tab you are already on can
  // never move you off a mode you deliberately chose.
  it('hands the spec straight back when the pool already matches', () => {
    expect(axisForPool('best', 'shows')).toBe('best');
    const mine = { id: 'custom_1', custom: true, text: 'steals your food', items: 'characters' };
    expect(axisForPool(mine, 'characters')).toBe(mine);
  });

  it('resolves a custom prompt into the other pool rather than getting stuck', () => {
    const mine = { id: 'custom_1', custom: true, text: 'steals your food', items: 'shows' };
    expect(getAxis(axisForPool(mine, 'characters')))
      .toMatchObject({ kind: 'opinion', items: 'characters' });
  });

  // getAxis never returns undefined, and neither may this: a screen that cannot
  // name its axis renders a blank board.
  it('never returns something getAxis cannot resolve', () => {
    for (const spec of [undefined, null, 'nonsense', {}]) {
      for (const pool of ['shows', 'characters', 'junk']) {
        expect(getAxis(axisForPool(spec, pool))).toBeTruthy();
      }
    }
  });
});

describe('needsEndLabels', () => {
  // A built-in opinion label already reads top-to-bottom ("Best → Worst"), so
  // printing BEST → WORST underneath it is noise. This is the test that stops
  // the two rules drifting: add an opinion axis whose label names a dimension
  // instead of a direction and the picker would silently stop explaining it.
  it('is false for every built-in opinion mode, whose label is already a direction', () => {
    for (const axis of axesOfKind('opinion')) {
      expect(needsEndLabels(axis), `${axis.id}`).toBe(false);
      expect(axis.label, `${axis.id} label`).toContain('→');
    }
  });

  it('is true for every fact mode, whose label names a dimension', () => {
    for (const axis of axesOfKind('fact')) {
      expect(needsEndLabels(axis), `${axis.id}`).toBe(true);
    }
  });

  it('is true for a custom prompt, whose label is a clause', () => {
    expect(needsEndLabels(customAxis({ text: 'steals your food' }))).toBe(true);
  });
});
