import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  commitDraft,
  isDraftOutOfRange,
  parseDraft,
  sanitizeDraft,
  stepValue,
} from '../utils/numberField';

// Every numeric setting in the arcade — AniGuess's timer and point values,
// AniTune's question count and clip length, AniFake's clue rounds, the AniList
// import's favourites floor — was an `<Input type="number">` with a clamp
// hand-rolled at the call site. Ten of them across seven files, and they had
// already drifted: only AniFake clamped both ends, AniTune clamped the floor
// only, and the rest clamped nothing at all (`min={0}` is an attribute, which
// bounds the spinner arrows and not the keyboard, so a typed -5 went through).
// Same story as useRoomCore.js and Combobox.jsx.
//
// They also all shared one bug. State was a number, updated with
// `parseInt(e.target.value) || fallback`, so an empty field could not exist:
// backspacing a 10 capped at 10 snapped the box to 1, the next digit landed
// after it, and the keystroke clamp turned the 13 back into 10. The value 3
// was unreachable by typing. The fix is three things together, and none of
// them works alone:
//
//   1. the draft is a STRING while focused, so "" is a state the field can be
//      in (see shared/utils/numberField.js);
//   2. the clamp happens on BLUR, not per keystroke, so a half-typed number is
//      allowed to be briefly illegal;
//   3. focus SELECTS the contents, so typing 3 over 10 replaces it.
//
// `draft === null` means "not editing" and the `value` prop is the truth; a
// string means the field is being edited and the draft is. Because those two
// never both apply, no syncing effect is needed.

// Native spin arrows are ~10px tall, unstyleable, and invisible on touch, so
// they are replaced by real blocks. Delay before the hold starts repeating,
// then the gap between repeats.
const REPEAT_DELAY_MS = 500;
const REPEAT_MS = 80;

// The input's padding sets the block's height and the buttons stretch to it
// (`items-stretch`), so a size is one padding choice plus matching type scales.
// This only became possible once the control stopped composing Field's `Input`,
// whose BASE hard-codes py-3.
const SIZES = {
  md: { button: 'w-14 text-2xl', input: 'py-3 text-lg' },
  // py-2.5 rather than py-2 so the block clears 44px — the buttons are square
  // to the input's height, and 43px is under the touch-target floor.
  sm: { button: 'w-11 text-xl', input: 'py-2.5 text-base' },
};

export default function NumberInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  size = 'md',
  id,
  ariaLabel = 'value',
  disabled = false,
  className = '',
  inputClassName = '',
}) {
  const [draft, setDraft] = useState(null);
  const hintId = useId();
  const sizing = SIZES[size];

  // The repeat timer fires faster than React re-renders, so it reads the value
  // from a ref it also writes — otherwise a held button steps 3 → 4 → 4 → 4.
  // `bump` updates this eagerly; the effect only catches changes that came
  // from outside (a settings reset), so it can safely lag a tick.
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  // What the field held when editing started, so Escape is a real undo even
  // though in-range keystrokes are published live.
  const focusValueRef = useRef(value);
  const repeatRef = useRef(null);

  const stopRepeat = useCallback(() => {
    if (!repeatRef.current) return;
    clearTimeout(repeatRef.current.timeout);
    clearInterval(repeatRef.current.interval);
    repeatRef.current = null;
  }, []);

  // A pointer released anywhere — off the button, outside the window — must
  // stop the repeat, so this listens on window rather than on the button.
  useEffect(() => {
    window.addEventListener('pointerup', stopRepeat);
    window.addEventListener('pointercancel', stopRepeat);
    return () => {
      window.removeEventListener('pointerup', stopRepeat);
      window.removeEventListener('pointercancel', stopRepeat);
      stopRepeat();
    };
  }, [stopRepeat]);

  const commit = (next) => {
    valueRef.current = next;
    if (next !== value) onChange(next);
  };

  const bump = (dir) => {
    const next = stepValue(valueRef.current, { min, max, step, dir });
    // Hitting the bound ends a hold; otherwise it spins silently until release.
    if (next === valueRef.current) {
      stopRepeat();
      return;
    }
    setDraft(null);
    commit(next);
  };

  const startRepeat = (dir) => {
    stopRepeat();
    bump(dir);
    const handle = { timeout: null, interval: null };
    handle.timeout = setTimeout(() => {
      handle.interval = setInterval(() => bump(dir), REPEAT_MS);
    }, REPEAT_DELAY_MS);
    repeatRef.current = handle;
  };

  const handleFocus = (e) => {
    focusValueRef.current = value;
    setDraft(String(value));
    e.target.select();
  };

  const handleChange = (e) => {
    const clean = sanitizeDraft(e.target.value, { min });
    setDraft(clean);
    // Publish only while the draft is already legal. Out-of-range and empty
    // drafts are left to sit until blur — that is the whole point.
    const parsed = parseDraft(clean);
    if (parsed != null && parsed >= min && parsed <= max) commit(parsed);
  };

  const handleBlur = () => {
    const next = commitDraft(draft, { min, max, fallback: value });
    setDraft(null);
    commit(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = draft == null ? value : commitDraft(draft, { min, max, fallback: value });
      const next = stepValue(base, { min, max, step, dir: e.key === 'ArrowUp' ? 1 : -1 });
      setDraft(String(next));
      commit(next);
    } else if (e.key === 'Enter') {
      // Without this a field inside a form submits it with the draft still
      // uncommitted. Blurring runs handleBlur, which is the commit.
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      const restored = commitDraft(String(focusValueRef.current), { min, max, fallback: min });
      setDraft(String(restored));
      commit(restored);
    }
  };

  const text = draft ?? String(value);
  const invalid = isDraftOutOfRange(text, { min, max });

  // `side` is which edge of the block this button sits on, and decides which
  // way its divider faces. No border of its own: the wrapper draws the outline
  // and these only need the hairline between themselves and the number.
  const stepper = (dir, glyph, verb, atBound, side) => (
    <button
      type="button"
      disabled={disabled || atBound}
      aria-label={`${verb} ${ariaLabel}`}
      // preventDefault keeps focus in the text box, so holding + and then
      // typing does not need a second click to get back.
      onPointerDown={(e) => { e.preventDefault(); startRepeat(dir); }}
      onPointerUp={stopRepeat}
      onPointerLeave={stopRepeat}
      // A keyboard-activated click reports detail 0 and never fires
      // pointerdown, so this is the Enter/Space path — not a second mouse bump.
      onClick={(e) => { if (e.detail === 0) bump(dir); }}
      // No btn-pop: its press-down translate is the wrong physics inside a
      // fixed border — the block would slide out of its own outline. A
      // background tint reads as "pressed" without moving anything.
      className={`grid shrink-0 place-items-center font-black leading-none transition-colors
        outline-none focus-visible:bg-pop-purple/40
        ${sizing.button} ${side === 'left' ? 'border-r-2' : 'border-l-2'} border-ink
        ${disabled || atBound
          ? 'cursor-not-allowed bg-surface-2 text-white/20'
          : 'bg-pop-purple/20 text-white hover:bg-pop-purple/40 active:bg-pop-purple/60'}`}
    >
      {glyph}
    </button>
  );

  return (
    // The whole control is one bordered object, so the gap between two of them
    // is unambiguously larger than anything inside one. Three separate blocks
    // with a gap failed that test: in AniGuess's points row the 16px between
    // controls was only twice the 8px inside one, so eight identical squares
    // read as a wall and no button belonged to any number.
    //
    // The border/background/radius live here rather than on Field's `Input`,
    // which is why this composes a bare <input> — BASE sets all three plus its
    // own focus ring, and overriding four properties is worse than not
    // inheriting them.
    // max-w-64 because a two-digit setting inside a full-width Field otherwise
    // stretches to ~620px, and a stepper that wide reads as a text box someone
    // forgot to fill in. Callers set a narrower width freely (`w-40` in
    // AniGuess's rows); `max-w-none` opts back out.
    <div
      className={`flex max-w-64 items-stretch overflow-hidden rounded-pop-sm border-2 bg-surface-2
        transition-colors focus-within:ring-4 focus-within:ring-white/80
        focus-within:ring-offset-2 focus-within:ring-offset-canvas
        ${invalid ? 'border-pop-red' : 'border-ink'}
        ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {stepper(-1, '−', 'Decrease', value <= min, 'left')}
      <input
        id={id}
        type="text"
        // Not type="number": it mutates a focused field when the page scrolls
        // under the cursor, and its .value reads "" for anything the browser
        // judges invalid, so the draft above could never be read back. The
        // steppers give back what its arrows provided.
        inputMode="numeric"
        autoComplete="off"
        value={text}
        disabled={disabled}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={hintId}
        // The ring belongs to the wrapper, so the input itself must not draw
        // one — two rings on nested elements read as a rendering glitch.
        className={`min-w-0 flex-1 bg-transparent px-2 text-center font-display font-extrabold
          tabular-nums text-white outline-none ${sizing.input} ${inputClassName}`}
      />
      {stepper(1, '+', 'Increase', value >= max, 'right')}
      <span id={hintId} className="sr-only">
        {Number.isFinite(max) ? `Minimum ${min}, maximum ${max}` : `Minimum ${min}`}
      </span>
    </div>
  );
}
