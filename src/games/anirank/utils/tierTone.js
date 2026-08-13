// The colour of a tier row, strongest-good at the top down to strongest-bad at
// the bottom. The tier-list twin of rail.js, and it lives in its own module for
// the same reason: two components draw it (the builder and the compare screen)
// and a component file that also exports a helper breaks fast refresh.
//
// This is the ONE place in the app where red at the bottom is semantic rather
// than a vibe, and it is worth saying out loud because index.css's rule is
// otherwise "each accent has a fixed job — don't pick them by vibe at the call
// site". Those jobs are lime = yes/correct/ready and red = no/wrong. A tier
// list's top row IS the shows you say yes to and its bottom row IS the ones you
// say no to, so the ladder uses both tokens for exactly the job they were
// assigned. Every other ordered list in the app (the rank rail, the
// leaderboard) has no good/bad axis at all, which is why those step one accent
// instead of ramping across three.
//
// Discrete blocks knocked back by opacity, never a CSS gradient — there are no
// gradients anywhere in this app.
//
// FIVE ENTRIES, MATCHING THE FIVE DEFAULT ROWS, and that is not a coincidence
// to be tidied away. spread() maps row i onto the ladder proportionally, so a
// six-entry ladder made the default S/A/B/C/D board skip the solid amber in the
// middle — B and C came out as an olive and a maroon, which is nobody's idea of
// a tier list. Changing the length of this array silently re-tunes the default
// board; check that S/A/B/C/D still lands on each rung before doing it.
//
// The text colour is PAIRED with the background here rather than picked at the
// call site, because two of these rungs cannot take the same one. `text-ink` is
// near-black, and over `bg-pop-red/60` composited on the dark surface it falls
// to roughly 4:1 — under AA. Splitting the two lists apart is how that gets
// re-broken the next time a rung is retuned.
const LADDER = [
  { bg: 'bg-pop-lime', text: 'text-ink' },
  { bg: 'bg-pop-lime/60', text: 'text-ink' },
  { bg: 'bg-pop-amber', text: 'text-ink' },
  { bg: 'bg-pop-red/60', text: 'text-white' },
  { bg: 'bg-pop-red', text: 'text-ink' },
];

/**
 * The row's colour → { bg, text }.
 *
 * Spread across however many rows there are, rather than indexed: three rows
 * read good / middling / bad, and five read as the full ladder. Indexing would
 * render a three-tier list entirely in greens, because it would never reach
 * past rung 2.
 */
export function tierTone(i, count) {
  if (count <= 1) return LADDER[0];
  const at = Math.round((i / (count - 1)) * (LADDER.length - 1));
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, at))];
}
