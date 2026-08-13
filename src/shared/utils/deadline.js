// The pure half of a countdown: what a deadline *means*, with no clock of its
// own. Mirrors the split shared/utils/presence.js makes against usePresence —
// the arithmetic is testable without a DOM, and the hook (shared/hooks/
// useDeadline.js) only decides how often to re-read Date.now().
//
// Every instant here is absolute epoch-ms, already corrected for server skew by
// the caller. That convention is deliberate: a room's devices agree on an
// absolute instant but not on how long ago it was, so a deadline that travels
// through Firebase has to be "when", never "how much longer". AniTune's
// clipStartAt has always worked this way; this generalises it.

// What a correct answer is worth before any speed bonus. Named rather than
// inlined so a scorer reads `QUESTION_POINTS + speedBonus(...)` and the ceiling
// of one question (2.0) is visible in one place.
export const QUESTION_POINTS = 1;

// Milliseconds left, never negative. Callers render this, so a past deadline
// has to read as 0 rather than counting up through minus numbers — and null
// (no deadline set, e.g. an untimed game) is 0 for the same reason, since a
// missing deadline is not an expired one. Check `deadlineAt == null` yourself
// if you need to tell those apart; expired() below does.
export function remainingMs(deadlineAt, now) {
  if (deadlineAt == null || !Number.isFinite(deadlineAt)) return 0;
  return Math.max(0, deadlineAt - now);
}

// True only when a deadline exists AND has passed. An untimed round leaves
// windowEndsAt null and must never look expired, or the round would reveal the
// instant it was dealt.
export function isExpired(deadlineAt, now) {
  if (deadlineAt == null || !Number.isFinite(deadlineAt)) return false;
  return now >= deadlineAt;
}

// How far into the window we are, 0..1 — what a progress bar wants. A null or
// zero-length window returns 0, so a bar for an untimed round sits empty rather
// than dividing by zero and rendering NaN%.
export function elapsedFraction(startAt, windowMs, now) {
  if (startAt == null || !windowMs || windowMs <= 0) return 0;
  return Math.min(1, Math.max(0, (now - startAt) / windowMs));
}

/**
 * The speed half of a score, 0..1: 1 for an instant answer, 0 at the buzzer.
 *
 * Linear, not curved. A curve would make the difference between 1s and 3s
 * enormous and the difference between 12s and 18s nothing, which rewards
 * reflexes over recognition — and recognition is the game. Linear also means
 * the number on the reveal ("+0.89") is one a player can predict from the bar
 * they were watching, so the scoring feels earned rather than conjured.
 *
 * Clamped at both ends: an answer submitted after the deadline (the last write
 * racing the expiry transaction) is worth the base and no bonus, never a
 * negative that would make a correct answer cost points.
 */
export function speedBonus(elapsedMs, windowMs) {
  if (!windowMs || windowMs <= 0) return 0;
  if (!Number.isFinite(elapsedMs)) return 0;
  return Math.min(1, Math.max(0, 1 - elapsedMs / windowMs));
}

// Scores round to fractions, so totals need formatting in several places
// (per-question reveal, running scoreboard, final results) and they must agree.
// One decimal: enough to see that a fast answer beat a slow one, few enough
// digits that a scoreboard column stays narrow. Whole numbers keep no ".0" —
// an untimed game should not suddenly look like a spreadsheet.
export function formatPoints(points) {
  const n = Number(points) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Seconds, one decimal, for "answered in 2.1s" on the reveal.
export function formatSeconds(ms) {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}
