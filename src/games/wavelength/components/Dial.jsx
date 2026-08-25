import { useRef } from 'react';
import { BANDS, DIAL_MAX, DIAL_MIN } from '../rules';
import {
  polar, pointToValue, spreadAngles, valueToAngle, wedgePath,
} from '../utils/arc';

// The spectrum, its two end caps, and the needle. One component for all three
// places a dial appears — the psychic's screen, a guesser's turn, and the
// reveal — because they differ only in what is visible, never in geometry.
// Three components would be three chances for the target band and the needle to
// land on subtly different pixels, which on this screen reads as a scoring bug.
//
// ALL GEOMETRY LIVES IN utils/arc.js, none of it here. The vitest config only
// runs `src/**/*.test.js` under environment: 'node', so anything computed in
// this file is untestable by construction — and angle maths is exactly the code
// that fails silently, putting the needle somewhere plausible and wrong.
//
// KEYBOARD AND POINTER ARE HANDLED SEPARATELY, and that split is the one thing
// here worth reading twice. The flat dial this replaces could let a transparent
// <input type="range"> lie over the track and take everything — keyboard, touch,
// drag, screen readers — because a range maps x linearly to value and so did the
// track. On an arc it does not: x is cos(angle), so a tap on the visible needle
// would jump somewhere else entirely. So the input stays for what only it can
// do (arrow keys, Home/End, aria-valuetext) with pointer-events-none, and
// pointers go through pointToValue on the SVG itself. Deleting either half
// breaks a whole class of user.
const VB_W = 260;
const VB_H = 150;
const CX = 130;
const CY = 134;
const R_OUTER = 106;
const R_INNER = 62;
// Outside the ring, where a badge does not sit on top of the bands it is
// reporting against. Chosen so a badge centred at either cap still clears the
// viewBox edge once its own width is counted.
const R_LABEL = 120;
const R_NEEDLE_IN = 26;

// Widest first so the narrowest paints on top. Opacity carries "closer is
// better" without inventing a second colour meaning: index.css already assigns
// lime = correct, and a band is just how correct.
const BAND_TONES = ['fill-pop-lime/20', 'fill-pop-lime/40', 'fill-pop-lime/80'];

// A badge is about 22 units wide at R_LABEL, which is this many degrees of arc.
const LABEL_GAP_DEG = 11;

const pctX = (x) => `${(x / VB_W) * 100}%`;
const pctY = (y) => `${(y / VB_H) * 100}%`;
const clamp = (n) => Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(n)));

function TargetBands({ target, animate }) {
  // Widest band first, so BANDS' ascending order has to be reversed here. Read
  // together with scoreDial, which depends on the ascending order.
  const widest = [...BANDS].reverse();
  return widest.map((band, i) => (
    <path
      key={band.within}
      // wedgePath clamps, so a band running off a cap is cropped to the track
      // rather than drawn past it — which is what keeps the painted bands and
      // the scored distances the same object.
      d={wedgePath(CX, CY, R_INNER, R_OUTER, target - band.within, target + band.within)}
      className={`${BAND_TONES[i] ?? 'fill-pop-lime/20'} ${animate ? 'dial-band-in' : ''}`}
      style={animate ? { animationDelay: `${i * 90}ms` } : undefined}
    />
  ));
}

// A line across the ring at one dial value: the centre tick, a guess marker,
// or the needle. Every position in this file comes through here or through
// polar, so nothing computes an angle by hand.
function Spoke({ value, from, to, className, style }) {
  const deg = valueToAngle(value);
  const a = polar(CX, CY, from, deg);
  const b = polar(CX, CY, to, deg);
  return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={className} style={style} />;
}

export default function Dial({
  spectrum,
  value = null,
  onChange,
  target = null,
  markers = [],
  disabled = false,
  label,
  animate = false,
}) {
  const svgRef = useRef(null);
  const readOnly = !onChange || disabled;
  const describedAs = label || `${spectrum.leftLabel} to ${spectrum.rightLabel}`;
  const placed = Number.isFinite(value);

  // The element's aspect ratio is the viewBox's (an <svg> with a viewBox and a
  // width but no height derives one), so this linear map is exact rather than
  // approximate — no getScreenCTM needed.
  const commit = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    const y = ((e.clientY - rect.top) / rect.height) * VB_H;
    onChange(clamp(pointToValue(x, y, { cx: CX, cy: CY })));
  };

  // Badges are HTML rather than SVG <text>: a text width is not knowable in
  // advance, so a rect behind it would have to be guessed at. Their angles are
  // spread apart first — on a bar two dials three apart merely crowded, but
  // around a centre they are near-concentric and the second hides the first, on
  // the one screen whose entire job is showing people where their guess landed.
  const spread = spreadAngles(markers.map((m) => valueToAngle(m.value)), LABEL_GAP_DEG);

  return (
    <div>
      <div className="relative">
        {/* First in the DOM so `peer-*` can style the arc behind it — peer
            variants only reach FOLLOWING siblings. pointer-events-none is what
            keeps it from swallowing the taps the SVG needs; it is here for the
            keyboard and the screen reader, nothing else. */}
        {!readOnly && (
          <input
            type="range"
            min={DIAL_MIN}
            max={DIAL_MAX}
            step={1}
            value={placed ? value : Math.round((DIAL_MIN + DIAL_MAX) / 2)}
            // Number(), not the raw string. A range input reports `value` as a
            // string, and every consumer of this callback tests the result with
            // Number.isFinite to decide whether a dial has been placed at all —
            // which a string always fails. Converting here, in the component
            // that owns the input, is the one place a future caller cannot
            // forget it.
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={describedAs}
            // Spoken instead of the bare number, which on its own tells a screen
            // reader user nothing about which end they are near.
            aria-valuetext={`${placed ? value : '—'} of ${DIAL_MAX}, between ${spectrum.leftLabel} and ${spectrum.rightLabel}`}
            className="peer pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        )}

        <div className="rounded-pop peer-focus-visible:ring-4 peer-focus-visible:ring-pop-pink">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className={`block w-full ${readOnly ? '' : 'cursor-pointer touch-none'}`}
            aria-hidden="true"
            onPointerDown={readOnly ? undefined : (e) => {
              // Capture, so a drag that leaves the element keeps steering it.
              e.currentTarget.setPointerCapture(e.pointerId);
              commit(e);
            }}
            onPointerMove={readOnly ? undefined : (e) => { if (e.buttons) commit(e); }}
          >
            <path
              d={wedgePath(CX, CY, R_INNER, R_OUTER, DIAL_MIN, DIAL_MAX)}
              className="fill-surface-2 stroke-ink"
              strokeWidth="2"
            />

            {Number.isFinite(target) && <TargetBands target={target} animate={animate} />}

            {/* The midpoint, so an untouched dial still reads as a scale. */}
            <Spoke value={50} from={R_INNER} to={R_OUTER} className="stroke-white/15" strokeWidth="1" />

            {markers.map((m) => (
              <Spoke
                key={m.playerId}
                value={m.value}
                from={R_INNER}
                to={R_OUTER}
                className="stroke-white/70"
                strokeWidth="2"
              />
            ))}

            {placed && (
              <>
                <Spoke
                  value={value}
                  from={R_NEEDLE_IN}
                  to={R_OUTER + 4}
                  className="stroke-pop-pink"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx={CX} cy={CY} r="10" className="fill-pop-pink stroke-ink" strokeWidth="2" />
              </>
            )}
          </svg>
        </div>

        {markers.map((m, i) => {
          const p = polar(CX, CY, R_LABEL, spread[i]);
          return (
            <span
              key={m.playerId}
              title={`${m.name}: ${m.value}`}
              style={{
                left: pctX(p.x),
                top: pctY(p.y),
                // After the bands, and one at a time in dial order.
                ...(animate ? { animationDelay: `${260 + i * 110}ms` } : null),
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-pop-sm border border-ink
                bg-white px-1 font-display text-[10px] font-extrabold text-ink
                ${animate ? 'dial-marker-in' : ''}`}
            >
              {m.short}
            </span>
          );
        })}
      </div>

      <div className="mt-1 flex items-start justify-between gap-3">
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-white/60">
          ← {spectrum.leftLabel}
        </span>
        <span className="text-right font-display text-xs font-extrabold uppercase tracking-widest text-white/60">
          {spectrum.rightLabel} →
        </span>
      </div>

      {/* Single-step nudges and a readout. The arc is a coarse control by
          nature — a whole spectrum across a phone's width is roughly two units
          per pixel — and the bullseye is four wide, so without these the
          difference between 4 points and 3 is below the resolution of a
          fingertip. Real buttons, so they are on the keyboard path too.
          Nudging from 50 when nothing is placed yet means the first press
          places the dial rather than doing nothing. */}
      {!readOnly && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onChange(clamp((placed ? value : 50) - 1))}
            aria-label="Nudge left"
            className="focus-pop grid h-11 w-11 place-items-center rounded-pop-sm border-2 border-white/15
              bg-surface-2 font-display text-xl font-black text-white hover:bg-surface"
          >
            −
          </button>
          <span
            className="min-w-[3.5rem] text-center font-display text-2xl font-extrabold tabular-nums text-white"
            aria-hidden="true"
          >
            {placed ? value : '—'}
          </span>
          <button
            type="button"
            onClick={() => onChange(clamp((placed ? value : 50) + 1))}
            aria-label="Nudge right"
            className="focus-pop grid h-11 w-11 place-items-center rounded-pop-sm border-2 border-white/15
              bg-surface-2 font-display text-xl font-black text-white hover:bg-surface"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
