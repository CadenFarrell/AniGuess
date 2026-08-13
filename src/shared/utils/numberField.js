// The parse/clamp/commit half of NumberInput, kept pure so it can be tested —
// the vitest config only runs `src/**/*.test.js` under `node`, so anything
// worth asserting has to live outside the .jsx.
//
// The whole point of this module is that a *draft* is a string, not a number.
// Every numeric setting in the app used to store a number and update it with
// `parseInt(e.target.value) || fallback`, which cannot represent an empty
// field: backspacing the box clear snapped it to the floor, so the next digit
// landed after that floor instead of replacing it (clear a 10 capped at 10,
// type 3, get 13, get clamped back to 10 — the value was unreachable by
// typing). A draft that is allowed to be "" or briefly out of range, and is
// only resolved to a number on commit, is the fix.

// Strict, because `parseInt` is too forgiving in both directions that matter
// here: `parseInt('12abc')` is 12 (silently keeping half a paste) and
// `parseInt('') || 1` is the bug above. Anything that is not a whole number is
// `null`, which callers read as "no value yet", not as an error.
export function parseDraft(text) {
  const trimmed = String(text ?? '').trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function clampValue(n, { min = -Infinity, max = Infinity } = {}) {
  return Math.min(max, Math.max(min, n));
}

// Resolve a draft to a legal number. An empty draft returns `fallback` — the
// value the field held when editing started — rather than `min`: clearing a
// box and tabbing away is a cancelled edit, not a request for the minimum.
export function commitDraft(text, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const parsed = parseDraft(text);
  if (parsed == null) return clampValue(fallback, { min, max });
  return clampValue(parsed, { min, max });
}

// `dir` is +1 or -1. Steps from the value, then clamps, so a value already out
// of range (a pref saved before these bounds existed) walks back inside rather
// than jumping.
export function stepValue(value, { min = -Infinity, max = Infinity, step = 1, dir = 1 } = {}) {
  return clampValue(value + step * dir, { min, max });
}

// Drives the red tint while typing. Empty is deliberately NOT out of range —
// it is the normal transient state between clearing a field and typing the
// replacement, and flagging it would make every edit flash an error.
export function isDraftOutOfRange(text, { min = -Infinity, max = Infinity } = {}) {
  const parsed = parseDraft(text);
  if (parsed == null) return false;
  return parsed < min || parsed > max;
}

// Keystroke filter for the text box. Digits only, plus a single leading `-`
// when the range actually allows a negative — no stripping of leading zeros,
// because rewriting what someone is halfway through typing moves their caret.
export function sanitizeDraft(text, { min = -Infinity } = {}) {
  const raw = String(text ?? '');
  const digits = raw.replace(/\D/g, '');
  const negative = min < 0 && raw.trimStart().startsWith('-');
  return negative ? `-${digits}` : digits;
}
