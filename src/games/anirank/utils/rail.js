// The amber ladder down the left of a board, strongest at the top — the slot-1
// -is-the-top convention made readable before any text is.
//
// Discrete blocks rather than a CSS gradient: there are no gradients anywhere in
// this app, and knocking one accent back by opacity is how the palette already
// renders a step down (see aniguess's Leaderboard, where bronze is a faded amber
// because there is no brown token).
//
// It lives in its own module because two components draw it — RankBoard during
// play and AniRankResults when it redraws the same board to explain the score —
// and a component file that also exports a helper breaks fast refresh.
const RAIL = ['bg-pop-amber', 'bg-pop-amber/60', 'bg-pop-amber/30', 'bg-pop-amber/10'];

export const railTone = (i, size) =>
  RAIL[Math.min(RAIL.length - 1, Math.floor((i / Math.max(size, 1)) * RAIL.length))];
