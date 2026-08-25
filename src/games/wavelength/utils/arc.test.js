import { describe, it, expect } from 'vitest';
import {
  ARC_SPAN, angleToValue, pointToValue, polar, spreadAngles, valueToAngle, wedgePath,
} from './arc';
import { DIAL_MAX, DIAL_MIN } from '../rules';

const CENTRE = { cx: 120, cy: 118 };

describe('value ⇄ angle', () => {
  // The direction promise, in geometry. spectra.test.js pins the same promise in
  // labels: leftLabel names DIAL_MIN. If these two ever disagree the dial draws
  // the psychic's target under the wrong word and every score inverts.
  it('puts DIAL_MIN at the left cap and DIAL_MAX at the right', () => {
    expect(valueToAngle(DIAL_MIN)).toBe(ARC_SPAN);
    expect(valueToAngle(DIAL_MAX)).toBe(0);
  });

  it('puts the midpoint at the top', () => {
    expect(valueToAngle(50)).toBe(90);
  });

  it('round-trips across the whole range', () => {
    for (let v = DIAL_MIN; v <= DIAL_MAX; v++) {
      expect(angleToValue(valueToAngle(v)), `value ${v}`).toBeCloseTo(v, 9);
    }
  });

  it('runs monotonically — angle falls as value rises', () => {
    for (let v = DIAL_MIN; v < DIAL_MAX; v++) {
      expect(valueToAngle(v + 1), `value ${v}`).toBeLessThan(valueToAngle(v));
    }
  });

  it('clamps out-of-range values rather than running off the arc', () => {
    expect(valueToAngle(-40)).toBe(ARC_SPAN);
    expect(valueToAngle(400)).toBe(0);
    expect(angleToValue(-90)).toBe(DIAL_MAX);
    expect(angleToValue(400)).toBe(DIAL_MIN);
  });
});

describe('polar', () => {
  it('flips into SVG y-down, so the top of the dial is the SMALLEST y', () => {
    const top = polar(CENTRE.cx, CENTRE.cy, 100, 90);
    expect(top.x).toBeCloseTo(CENTRE.cx, 6);
    expect(top.y).toBeCloseTo(CENTRE.cy - 100, 6);
  });

  it('puts 180° left of centre and 0° right of it, both on the baseline', () => {
    expect(polar(CENTRE.cx, CENTRE.cy, 100, 180)).toEqual({ x: 20, y: 118 });
    expect(polar(CENTRE.cx, CENTRE.cy, 100, 0)).toEqual({ x: 220, y: 118 });
  });
});

describe('pointToValue', () => {
  it('reads a tap straight up as the midpoint', () => {
    expect(pointToValue(CENTRE.cx, CENTRE.cy - 80, CENTRE)).toBeCloseTo(50, 6);
  });

  it('agrees with valueToAngle — a tap ON a value returns that value', () => {
    for (let v = 1; v < DIAL_MAX; v++) {
      const p = polar(CENTRE.cx, CENTRE.cy, 90, valueToAngle(v));
      expect(pointToValue(p.x, p.y, CENTRE), `value ${v}`).toBeCloseTo(v, 2);
    }
  });

  // The bug this exists to stop: atan2 goes negative below the baseline, which
  // angleToValue reads as past DIAL_MAX and clamps to 100 — so a drag dipping
  // under the LEFT cap would snap to the far RIGHT end. It happens in ordinary
  // play, because a finger heading for the left cap crosses the baseline first.
  it('clamps below the baseline to the NEAR cap, never the far one', () => {
    expect(pointToValue(CENTRE.cx - 90, CENTRE.cy + 30, CENTRE)).toBe(DIAL_MIN);
    expect(pointToValue(CENTRE.cx + 90, CENTRE.cy + 30, CENTRE)).toBe(DIAL_MAX);
    // Exactly on the baseline counts as below: there is no arc there either.
    expect(pointToValue(CENTRE.cx - 90, CENTRE.cy, CENTRE)).toBe(DIAL_MIN);
  });

  it('ignores distance from the centre — only the angle decides', () => {
    const near = pointToValue(CENTRE.cx - 20, CENTRE.cy - 20, CENTRE);
    const far = pointToValue(CENTRE.cx - 200, CENTRE.cy - 200, CENTRE);
    expect(near).toBeCloseTo(far, 6);
  });
});

describe('wedgePath', () => {
  it('starts at the low value and closes the shape', () => {
    const d = wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, 40, 60);
    const start = polar(CENTRE.cx, CENTRE.cy, 100, valueToAngle(40));
    expect(d.startsWith(`M ${start.x} ${start.y}`)).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('does not care which order the two values arrive in', () => {
    expect(wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, 60, 40))
      .toBe(wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, 40, 60));
  });

  // A band centred near a cap runs off the track. Cropping it is what keeps the
  // painted bands and the scored distances the same object.
  it('crops a band running past an end instead of drawing past it', () => {
    expect(wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, -18, 4))
      .toBe(wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, 0, 4));
  });

  it('never sets the large-arc flag on a semicircle', () => {
    expect(wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, DIAL_MIN, DIAL_MAX)).not.toMatch(/ 1 1 /);
  });

  it('emits only finite numbers — one NaN silently blanks the whole band', () => {
    const d = wedgePath(CENTRE.cx, CENTRE.cy, 50, 100, 12, 34);
    expect(d).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe('spreadAngles', () => {
  it('leaves angles that already clear the gap exactly where they are', () => {
    expect(spreadAngles([20, 60, 120], 9)).toEqual([20, 60, 120]);
  });

  it('pushes a cluster apart to at least the minimum gap', () => {
    const out = spreadAngles([90, 92, 94], 9);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(9 - 1e-9);
    }
  });

  // Order is the point: these badges name people, so two swapping places is
  // worse than two overlapping — it attributes a guess to the wrong player.
  it('preserves order, and returns results in the input order', () => {
    const input = [95, 90, 92];
    const out = spreadAngles(input, 9);
    // Same ranking in, same ranking out.
    const rank = (arr) => arr.map((_, i) => arr.filter((v) => v < arr[i]).length);
    expect(rank(out)).toEqual(rank(input));
    expect(out.length).toBe(input.length);
  });

  it('spreads a pile-up at the far cap inward instead of stacking on it', () => {
    const out = spreadAngles([178, 179, 180], 9);
    expect(Math.max(...out)).toBeLessThanOrEqual(ARC_SPAN);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    const sorted = [...out].sort((a, b) => a - b);
    expect(sorted[2] - sorted[0]).toBeGreaterThan(9);
  });

  it('keeps everything on the arc', () => {
    const out = spreadAngles([0, 1, 2, 3, 178, 179, 180], 9);
    for (const deg of out) {
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThanOrEqual(ARC_SPAN);
    }
  });

  it('handles the empty and single cases', () => {
    expect(spreadAngles([], 9)).toEqual([]);
    expect(spreadAngles([44], 9)).toEqual([44]);
  });
});
