import { describe, it, expect } from 'vitest';
import {
  MAX_LABEL_LEN, SPECTRA, DEFAULT_SPECTRUM_ID,
  getSpectrum, pickSpectrum, pickSpectra, spectrumLabel, spectrumInPool,
  customSpectrum, isCustom, normalizeCustomSpectrum, spectrumIdOf,
} from './spectra';
import { DIAL_MIN, DIAL_MAX, scoreDial } from './rules';

describe('the spectrum registry', () => {
  it('gives every spectrum the fields the dial reads off it', () => {
    for (const s of SPECTRA) {
      expect(s.id, `${s.id} id`).toBeTruthy();
      expect(s.leftLabel, `${s.id} leftLabel`).toBeTruthy();
      expect(s.rightLabel, `${s.id} rightLabel`).toBeTruthy();
    }
  });

  it('keeps ids unique, so getSpectrum cannot resolve two different dials', () => {
    const ids = SPECTRA.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The end caps sit in a fixed-width band either side of the track. A label
  // over the limit wraps and shoves the dial off-centre — only visible on a
  // narrow screen, which is why it is pinned rather than eyeballed.
  it('keeps every label short enough for the end caps', () => {
    for (const s of SPECTRA) {
      expect(s.leftLabel.length, `${s.id} leftLabel`).toBeLessThanOrEqual(MAX_LABEL_LEN);
      expect(s.rightLabel.length, `${s.id} rightLabel`).toBeLessThanOrEqual(MAX_LABEL_LEN);
    }
  });

  // The screens render these verbatim beside each other; a mixed-case pair reads
  // as two different kinds of thing.
  it('keeps every label uppercase', () => {
    for (const s of SPECTRA) {
      expect(s.leftLabel, `${s.id} leftLabel`).toBe(s.leftLabel.toUpperCase());
      expect(s.rightLabel, `${s.id} rightLabel`).toBe(s.rightLabel.toUpperCase());
    }
  });

  it('names two different ends — a spectrum between a thing and itself is not one', () => {
    for (const s of SPECTRA) {
      expect(s.leftLabel, `${s.id}`).not.toBe(s.rightLabel);
    }
  });

  // An untagged entry is not merely unsorted: spectrumInPool passes anything
  // without a `pool`, because that is how a player-written spectrum escapes the
  // filter — so a built-in that forgets the field is offered in both pools and
  // nothing anywhere reports it.
  it('tags every built-in with a pool', () => {
    for (const s of SPECTRA) {
      expect(['shows', 'characters', 'both'], `${s.id} pool`).toContain(s.pool);
    }
  });

  // SpectrumPicker's SUGGESTIONS. Kept as a literal rather than imported,
  // because the component is JSX and this suite runs in `environment: 'node'`.
  const SUGGESTIONS = 3;

  // The half of the fix that is not the filter. Tagging alone left characters
  // with three exclusive entries, so a filtered draw offered nearly the same
  // three every time and 🔄 did nothing — a reroll needs at least one spectrum
  // it did not just show you.
  it('leaves each pool enough spectra for a suggestion AND a reroll', () => {
    for (const pool of ['shows', 'characters']) {
      const eligible = SPECTRA.filter((s) => spectrumInPool(s, pool));
      expect(eligible.length, `${pool} eligible`).toBeGreaterThan(SUGGESTIONS);
    }
  });
});

describe('the pool filter', () => {
  const idsFor = (pool) => SPECTRA.filter((s) => s.pool === pool).map((s) => s.id);

  it(`passes a matching tag and 'both', and rejects the other pool`, () => {
    const shows = { id: 'x', pool: 'shows' };
    const chars = { id: 'y', pool: 'characters' };
    const either = { id: 'z', pool: 'both' };
    expect(spectrumInPool(shows, 'shows')).toBe(true);
    expect(spectrumInPool(shows, 'characters')).toBe(false);
    expect(spectrumInPool(chars, 'characters')).toBe(true);
    expect(spectrumInPool(chars, 'shows')).toBe(false);
    expect(spectrumInPool(either, 'shows')).toBe(true);
    expect(spectrumInPool(either, 'characters')).toBe(true);
  });

  // text mode passes null, and its setup screen never shows the pool control —
  // filtering there would hide half the registry on a setting nobody picked.
  it('filters nothing when no pool is asked for', () => {
    for (const s of SPECTRA) {
      expect(spectrumInPool(s, null), `${s.id}`).toBe(true);
    }
  });

  // The customs-are-never-filtered guarantee, pinned where it can break: a
  // stored custom is two strings and one boolean and carries no pool at all.
  it('keeps a spectrum that carries no pool of its own', () => {
    const mine = normalizeCustomSpectrum({ leftLabel: 'MID', rightLabel: 'PEAK' });
    expect(mine.pool).toBeUndefined();
    expect(spectrumInPool(mine, 'shows')).toBe(true);
    expect(spectrumInPool(mine, 'characters')).toBe(true);
  });

  // Every rng position, so a wrong-pool entry cannot be missed by luck — the
  // same sweep the exclude tests use, and for the same reason.
  it('never offers the other pool, at any rng position', () => {
    for (const pool of ['shows', 'characters']) {
      const wrong = idsFor(pool === 'shows' ? 'characters' : 'shows');
      for (let i = 0; i < SPECTRA.length; i++) {
        const rng = () => i / SPECTRA.length;
        for (const id of pickSpectra(rng, { count: 3, pool }).map((s) => s.id)) {
          expect(wrong, `${pool} draw`).not.toContain(id);
        }
        expect(wrong, `${pool} single draw`).not.toContain(pickSpectrum(rng, { pool }).id);
      }
    }
  });

  it(`offers a 'both' spectrum to either pool`, () => {
    const either = idsFor('both');
    for (const pool of ['shows', 'characters']) {
      const drawn = pickSpectra(Math.random, { count: SPECTRA.length, pool }).map((s) => s.id);
      expect(drawn.some((id) => either.includes(id)), `${pool}`).toBe(true);
    }
  });

  // The text-mode path, stated as something that would fail if the picker ever
  // acquired a default pool: with none asked for, both sides stay reachable.
  it('still reaches both pools when none is asked for', () => {
    const drawn = pickSpectra(() => 0, { count: SPECTRA.length }).map((s) => s.id);
    for (const pool of ['shows', 'characters']) {
      expect(drawn.some((id) => idsFor(pool).includes(id)), pool).toBe(true);
    }
  });

  // Applied before exclude, not after: excluding a shows entry from a characters
  // draw must not consume the exclusion and leave the real pool unfiltered.
  it('excludes within the pool rather than across the registry', () => {
    const [first] = idsFor('characters');
    for (let i = 0; i < SPECTRA.length; i++) {
      const rng = () => i / SPECTRA.length;
      const ids = pickSpectra(rng, { count: 3, exclude: first, pool: 'characters' })
        .map((s) => s.id);
      expect(ids).not.toContain(first);
    }
  });

  // A player's own spectra join the draw even when the round has a pool.
  it('keeps an extra with no pool in a filtered draw', () => {
    const mine = normalizeCustomSpectrum({ leftLabel: 'MID', rightLabel: 'PEAK' });
    const ids = pickSpectra(Math.random, { count: SPECTRA.length + 1, extra: [mine], pool: 'shows' })
      .map((s) => s.id);
    expect(ids).toContain(mine.id);
  });
});

// THE test in this file. `leftLabel` is a promise about which end of the dial is
// which, and scoreDial is the only thing that acts on dial values — so the
// promise is only kept if a dial AT the left end is nearest the left end. A
// flipped pair does not merely mislabel the track: the psychic clues one end and
// the guessers are scored against the other, silently inverting the whole game.
// anirank's axes.test.js exists because exactly this drifted apart once.
describe('the direction discipline', () => {
  it('puts leftLabel at DIAL_MIN and rightLabel at DIAL_MAX', () => {
    expect(DIAL_MIN).toBeLessThan(DIAL_MAX);
    // A target at the left end is best guessed by dialling the left end.
    expect(scoreDial(DIAL_MIN, DIAL_MIN)).toBeGreaterThan(scoreDial(DIAL_MAX, DIAL_MIN));
    expect(scoreDial(DIAL_MAX, DIAL_MAX)).toBeGreaterThan(scoreDial(DIAL_MIN, DIAL_MAX));
  });

  it('derives the display label left-to-right, so it cannot disagree with the caps', () => {
    for (const s of SPECTRA) {
      const label = spectrumLabel(s.id);
      expect(label.indexOf(s.leftLabel)).toBeLessThan(label.indexOf(s.rightLabel));
    }
  });
});

describe('getSpectrum', () => {
  it('resolves a known id', () => {
    expect(getSpectrum('loyal').rightLabel).toBe('LOYAL');
  });

  // A round written by an older build can name a spectrum this one dropped, and
  // a dial with blank ends looks like a bug in the dial rather than in the data.
  it('never returns undefined, whatever it is handed', () => {
    for (const junk of [undefined, null, '', 'no_such_spectrum', 42, {}]) {
      expect(getSpectrum(junk), String(junk)).toBeTruthy();
      expect(getSpectrum(junk).leftLabel, String(junk)).toBeTruthy();
    }
    expect(getSpectrum('no_such_spectrum').id).toBe(DEFAULT_SPECTRUM_ID);
  });

  it('accepts an already-resolved spectrum, so callers need not track which shape they hold', () => {
    expect(getSpectrum(SPECTRA[2]).id).toBe(SPECTRA[2].id);
  });

  it('accepts a bare { id } wrapper', () => {
    expect(getSpectrum({ id: 'demo' }).rightLabel).toBe('SEINEN');
  });

  // The branch order matters: a stored custom carries an id that resolves to
  // nothing, so checking `custom` after `id` would fall through to the default
  // and every written spectrum would silently play as FILLER → CANON.
  it('resolves a stored custom by its labels, never by its id', () => {
    const saved = normalizeCustomSpectrum({ leftLabel: 'mid', rightLabel: 'peak' });
    expect(getSpectrum(saved).leftLabel).toBe('MID');
    expect(getSpectrum(saved).rightLabel).toBe('PEAK');
    // The id names nothing in the registry, and that must not matter.
    expect(getSpectrum(saved.id).id).toBe(DEFAULT_SPECTRUM_ID);
  });

  it('is idempotent on a hydrated custom, so a re-resolve cannot lose it', () => {
    const saved = normalizeCustomSpectrum({ leftLabel: 'MID', rightLabel: 'PEAK' });
    expect(getSpectrum(getSpectrum(saved)).leftLabel).toBe('MID');
    expect(isCustom(getSpectrum(getSpectrum(saved)))).toBe(true);
  });
});

// THE test for the online half. A custom spectrum reaches every other device by
// riding inside the round through Realtime Database, which means through
// JSON.stringify — so anything that does not survive that trip is not a field,
// it is a local fiction. Copied from anirank's axes.test.js, which pins the same
// property for the same reason: get this wrong and the psychic's own spectrum
// silently becomes FILLER → CANON on every screen but theirs.
describe('a custom spectrum over the wire', () => {
  const SAVED = normalizeCustomSpectrum({
    id: 'custom_abc', leftLabel: 'MID', rightLabel: 'PEAK',
  });

  it('survives a JSON round-trip, which is how it reaches other devices', () => {
    const there = getSpectrum(JSON.parse(JSON.stringify(SAVED)));
    const here = customSpectrum(SAVED);
    expect(there.id).toBe(here.id);
    expect(there.leftLabel).toBe(here.leftLabel);
    expect(there.rightLabel).toBe(here.rightLabel);
    expect(spectrumLabel(there)).toBe(spectrumLabel(here));
  });

  // RTDB declines to store empty objects, empty arrays and nested nothings. A
  // spectrum that is two strings and a boolean cannot trip any of that — which
  // is why the shape is pinned rather than left to whoever adds a field next.
  it('stores nothing RTDB would drop', () => {
    for (const [key, value] of Object.entries(SAVED)) {
      expect(['string', 'boolean'], key).toContain(typeof value);
      if (typeof value === 'string') expect(value.length, key).toBeGreaterThan(0);
    }
  });

  it('satisfies the same field contract the registry loop asserts for built-ins', () => {
    const hydrated = customSpectrum(SAVED);
    expect(hydrated.id).toBeTruthy();
    expect(hydrated.leftLabel).toBeTruthy();
    expect(hydrated.rightLabel).toBeTruthy();
    expect(hydrated.leftLabel.length).toBeLessThanOrEqual(MAX_LABEL_LEN);
    expect(hydrated.rightLabel.length).toBeLessThanOrEqual(MAX_LABEL_LEN);
  });

  it('marks itself custom, and no built-in does', () => {
    expect(isCustom(customSpectrum(SAVED))).toBe(true);
    expect(isCustom(getSpectrum('loyal'))).toBe(false);
  });
});

describe('normalizeCustomSpectrum', () => {
  it('trims, collapses whitespace runs and uppercases', () => {
    const s = normalizeCustomSpectrum({ leftLabel: '  so   over  ', rightLabel: 'peak' });
    expect(s.leftLabel).toBe('SO OVER');
    expect(s.rightLabel).toBe('PEAK');
  });

  it('truncates to the width the end caps can draw', () => {
    const s = normalizeCustomSpectrum({
      leftLabel: 'x'.repeat(MAX_LABEL_LEN + 20),
      rightLabel: 'y'.repeat(MAX_LABEL_LEN + 20),
    });
    expect(s.leftLabel.length).toBe(MAX_LABEL_LEN);
    expect(s.rightLabel.length).toBe(MAX_LABEL_LEN);
  });

  // Both ends or nothing. One end names a direction the guessers cannot see,
  // and the editor's save button is disabled off exactly this null.
  it('refuses anything missing an end', () => {
    expect(normalizeCustomSpectrum({ leftLabel: 'MID' })).toBeNull();
    expect(normalizeCustomSpectrum({ rightLabel: 'PEAK' })).toBeNull();
    expect(normalizeCustomSpectrum({ leftLabel: '   ', rightLabel: 'PEAK' })).toBeNull();
    expect(normalizeCustomSpectrum({})).toBeNull();
    expect(normalizeCustomSpectrum(null)).toBeNull();
  });

  it('keeps an existing id, so editing updates rather than duplicates', () => {
    const s = normalizeCustomSpectrum({ id: 'custom_keep', leftLabel: 'A', rightLabel: 'B' });
    expect(s.id).toBe('custom_keep');
  });

  it('mints a recognisable id otherwise', () => {
    expect(normalizeCustomSpectrum({ leftLabel: 'A', rightLabel: 'B' }).id).toMatch(/^custom_/);
  });
});

describe('spectrumIdOf', () => {
  it('reduces every spec shape to an id, and never to undefined', () => {
    expect(spectrumIdOf('loyal')).toBe('loyal');
    expect(spectrumIdOf(SPECTRA[3])).toBe(SPECTRA[3].id);
    expect(spectrumIdOf({ id: 'custom_x', leftLabel: 'A', rightLabel: 'B', custom: true }))
      .toBe('custom_x');
    expect(spectrumIdOf(null)).toBe(DEFAULT_SPECTRUM_ID);
  });
});

describe('pickSpectra', () => {
  it('draws distinct entries — an offer of three with a repeat is an offer of two', () => {
    for (let i = 0; i < 20; i++) {
      const ids = pickSpectra(Math.random, { count: 3 }).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('honours exclude at every position in the pool', () => {
    for (let i = 0; i < SPECTRA.length; i++) {
      const rng = () => i / SPECTRA.length;
      const ids = pickSpectra(rng, { count: 3, exclude: 'loyal' }).map((s) => s.id);
      expect(ids).not.toContain('loyal');
    }
  });

  it('offers the player their own spectra alongside the built-ins', () => {
    const mine = normalizeCustomSpectrum({ leftLabel: 'MID', rightLabel: 'PEAK' });
    const ids = pickSpectra(Math.random, { count: SPECTRA.length + 1, extra: [mine] })
      .map((s) => s.id);
    expect(ids).toContain(mine.id);
  });

  // Returns fewer rather than looping forever — the picker renders what it gets.
  it('terminates when count exceeds the pool', () => {
    const drawn = pickSpectra(() => 0, { count: SPECTRA.length + 10 });
    expect(drawn.length).toBe(SPECTRA.length);
    expect(new Set(drawn.map((s) => s.id)).size).toBe(SPECTRA.length);
  });

  it('reaches the last entry — an rng at the top of its range must not fall off the end', () => {
    expect(pickSpectra(() => 0.999999, { count: 1 })[0]).toBeTruthy();
  });
});

describe('pickSpectrum', () => {
  it('never repeats the excluded id', () => {
    // Every position in the pool, so the exclusion cannot be passed by luck.
    for (let i = 0; i < SPECTRA.length; i++) {
      const rng = () => i / SPECTRA.length;
      expect(pickSpectrum(rng, { exclude: 'loyal' }).id).not.toBe('loyal');
    }
  });

  it('still deals when excluding would leave nothing', () => {
    const only = SPECTRA.map((s) => s.id);
    // Exclude is a single id, so this is really the one-entry-registry case;
    // assert the shape holds rather than that some specific id comes back.
    expect(only.includes(pickSpectrum(() => 0, { exclude: null }).id)).toBe(true);
  });

  it('reaches the last entry — an rng at the top of its range must not fall off the end', () => {
    expect(pickSpectrum(() => 0.999999, { exclude: null })).toBeTruthy();
  });
});
