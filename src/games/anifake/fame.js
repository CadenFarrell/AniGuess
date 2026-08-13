// How well known the round's secret has to be. The shape mirrors modes.js
// deliberately — a labelled table plus a resolver that never returns undefined,
// because an id can arrive from a saved room written by an older build and a
// setup screen that cannot name its setting would render a blank control.
//
// The number each level carries is a QUANTILE, not a favourites count. Favourite
// counts are wildly scale-dependent — a mega-popular lead has 20k+, a perfectly
// well-known one has 400 — so any fixed threshold is right for one table's lists
// and wrong for every other. A quantile of the table's own pool adapts by
// itself. utils/pool.js turns it into a floor; see fameFloor there for the part
// that decides which entries the quantile is taken over, which matters more than
// the numbers below.

export const FAME_LEVELS = [
  {
    id: 'any',
    label: 'Anyone',
    blurb: 'Any shared character, however obscure.',
    // null, NOT 0. A quantile of zero is still a filter — it puts every entry
    // with a favourites count above every entry without one — so "Anyone" would
    // silently change the deal on any list carrying stats. Only an off switch
    // leaves the pick exactly as it was before this setting existed.
    quantile: null,
  },
  {
    id: 'known',
    label: 'Well-known',
    blurb: 'The more popular half of what you all share.',
    quantile: 0.5,
  },
  {
    id: 'iconic',
    label: 'Iconic',
    blurb: 'Only the biggest names. Needs a decent shared list.',
    quantile: 0.85,
  },
];

export const DEFAULT_FAME_ID = 'known';

const BY_ID = new Map(FAME_LEVELS.map((f) => [f.id, f]));

export function getFame(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_FAME_ID);
}
