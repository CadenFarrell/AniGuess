// The geometry behind the dial: value ⇄ angle, and the SVG paths drawn from it.
//
// SEPARATE FROM Dial.jsx ON PURPOSE. The vitest config only runs
// `src/**/*.test.js` under environment: 'node', so anything living inside a
// .jsx file is untestable by construction — and this is exactly the code worth
// testing, because every one of its failures is silent. A sign error in
// pointToValue does not throw; it puts the needle somewhere plausible and
// slightly wrong, which reads as the game mis-scoring.
//
// ONE COORDINATE SYSTEM, STILL. The flat dial's load-bearing trick was that
// DIAL_MIN..DIAL_MAX is 0..100 and therefore *is* a CSS percentage, so bands,
// markers and pointer could not disagree. An arc gives that up — a value is no
// longer a position — so the replacement discipline is that every position in
// the component comes through valueToAngle and polar, and nothing computes an
// angle by hand. Same property, one indirection deeper.
//
// The convention here is MATHEMATICAL, not SVG's: angles run counter-clockwise
// from the positive x-axis with y pointing UP, so 0° is the right cap, 90° is
// the top, 180° is the left cap. polar() is the single place the flip to SVG's
// y-down happens. Doing that conversion anywhere else is how the needle and the
// bands end up mirrored against each other.
import { DIAL_MAX, DIAL_MIN } from '../rules';

// A half turn, so the dial is a semicircle standing on its diameter.
export const ARC_SPAN = 180;

const clampValue = (v) => Math.min(DIAL_MAX, Math.max(DIAL_MIN, v));
// Three decimals is well past what a ~240-unit viewBox can resolve, and keeps
// the emitted path strings short enough to read in devtools.
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Where a dial value points, in degrees.
 *
 * DIAL_MIN → 180° (the left cap, which leftLabel names) and DIAL_MAX → 0°.
 * That inversion — value up, angle down — is the one counter-intuitive thing in
 * this file, and it is forced: the spectrum reads left-to-right, angles run
 * counter-clockwise, so they must oppose. spectra.test.js pins the label half of
 * the same promise against scoreDial.
 */
export const valueToAngle = (value) => (
  ARC_SPAN - (clampValue(value) * ARC_SPAN) / (DIAL_MAX - DIAL_MIN)
);

export const angleToValue = (deg) => (
  clampValue(((ARC_SPAN - deg) * (DIAL_MAX - DIAL_MIN)) / ARC_SPAN)
);

/**
 * A point on the circle, in SVG coordinates.
 *
 * The `cy - sin` is the whole y-flip: SVG's y grows downward, the maths above
 * assumes it grows up. Every other function here goes through this one.
 */
export function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: r3(cx + r * Math.cos(rad)), y: r3(cy - r * Math.sin(rad)) };
}

/**
 * The value a pointer at (px, py) is asking for.
 *
 * This is what makes "tap anywhere on the arc to jump there" honest. The flat
 * dial could let a transparent <input type="range"> handle pointers because a
 * range maps x linearly to value and so did the track; on an arc, x is
 * cos(angle), so the same overlay would send a tap on the visible needle
 * somewhere else entirely.
 *
 * BELOW THE BASELINE CLAMPS TO THE NEAR CAP rather than wrapping. atan2 returns
 * a negative angle down there, which angleToValue would read as past DIAL_MAX
 * and clamp to 100 — meaning a drag that dips under the left cap would snap to
 * the far RIGHT end. Picking the near side by the sign of dx is the fix, and it
 * matters in ordinary play: a finger dragging toward the left cap crosses the
 * baseline before it gets there.
 */
export function pointToValue(px, py, { cx, cy }) {
  const dx = px - cx;
  const dy = cy - py; // flip into y-up
  if (dy <= 0) return dx >= 0 ? DIAL_MAX : DIAL_MIN;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return angleToValue(deg);
}

/**
 * An annular sector spanning two dial values — one scoring band.
 *
 * Drawn as a filled wedge rather than a thick stroked arc so the bands can nest
 * without their ends overlapping into a darker cap, and so a band clipped by the
 * end of the track is cropped rather than drawn past it. The caller clamps the
 * values; `wedgePath(…, -6, 12)` is a band running off the left cap and comes
 * back as one that starts at 0.
 */
export function wedgePath(cx, cy, rInner, rOuter, fromValue, toValue) {
  const lo = clampValue(Math.min(fromValue, toValue));
  const hi = clampValue(Math.max(fromValue, toValue));
  // Values ascend, so angles descend: a1 is the larger.
  const a1 = valueToAngle(lo);
  const a2 = valueToAngle(hi);
  const o1 = polar(cx, cy, rOuter, a1);
  const o2 = polar(cx, cy, rOuter, a2);
  const i1 = polar(cx, cy, rInner, a1);
  const i2 = polar(cx, cy, rInner, a2);
  // Never set on a semicircle — an arc of exactly 180° is not *greater* than
  // 180 — but written out rather than hardcoded to 0, so a future quarter-dial
  // or three-quarter-dial does not need this rediscovered.
  const large = Math.abs(a1 - a2) > 180 ? 1 : 0;
  // Outward sweep 1, return sweep 0: with y flipped, travelling left cap →
  // top → right cap is clockwise on screen, and the inner edge runs back.
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
}

/**
 * Nudges overlapping label angles apart, keeping their order.
 *
 * The flat dial did not need this: two markers three apart were six pixels
 * apart and their badges merely crowded. On an arc the badges also rotate
 * around a centre, so the same two are near-concentric and the second hides the
 * first — on the one screen whose entire job is showing people where their guess
 * landed. RevealScreen's shortLabels solves the other half of that problem (two
 * players whose names start alike); this solves the geometric half.
 *
 * A single relaxation pass in each direction, not a solver. Order is preserved
 * because the forward pass only ever pushes an angle further along the sort, and
 * the backward pass — which exists so a cluster jammed against the 180° cap
 * spreads inward instead of piling up on it — only pulls back.
 */
export function spreadAngles(angles, minGap = 9) {
  const order = angles
    .map((deg, i) => ({ deg, i }))
    .sort((a, b) => a.deg - b.deg);

  for (let k = 1; k < order.length; k++) {
    const gap = order[k].deg - order[k - 1].deg;
    if (gap < minGap) order[k].deg = order[k - 1].deg + minGap;
  }
  // Anything pushed past the far cap comes back, dragging its neighbours.
  for (let k = order.length - 1; k >= 0; k--) {
    if (order[k].deg > ARC_SPAN) order[k].deg = ARC_SPAN;
    if (k > 0 && order[k].deg - order[k - 1].deg < minGap) {
      order[k - 1].deg = order[k].deg - minGap;
    }
  }

  const out = new Array(angles.length);
  for (const { deg, i } of order) out[i] = Math.min(ARC_SPAN, Math.max(0, deg));
  return out;
}
