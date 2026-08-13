// How well known the shows in a round have to be.
//
// A direct port of anifake/fame.js + fameFloor in anifake/utils/pool.js, moved
// from character `favourites` onto anime `popularity` — one of the STAT_KEYS
// profileMerge.js persists. Same three-coverage-case problem, same one-null
// degraded path; read the comments in anifake/utils/pool.js for the long version
// of why a naive quantile is a trap.
//
// Two differences from the AniFake original, both worth knowing before copying
// this to a third game:
//
//  1. **Missing is distinguishable from zero here.** collapseCharacters writes
//     `favourites ?? 0`, so by the time AniFake ranks anything an unmeasured
//     character and a genuinely unknown one are the same value, and it has to
//     use `> 0` as a proxy for "measured". Anime entries keep `popularity`
//     *absent* when it was never fetched (pickStats only stores non-null), so
//     coverage here is the honest `!= null`. The coverage rule still applies —
//     it exists for the partial case, not the empty one.
//  2. **The default level is off.** mergePrefs fills missing keys from the
//     defaults on the next read, so a level that filtered by default would
//     quietly shrink the pool of every player who never opens the settings card.
//     A dial nobody asked for should do nothing until they touch it.

// The number each level carries is a QUANTILE of the table's own pool, not a
// popularity count — AniList popularity spans five orders of magnitude, so any
// fixed threshold is right for one set of lists and wrong for every other.
export const POPULARITY_LEVELS = [
  {
    id: 'any',
    label: 'Anything',
    blurb: 'Every eligible show, however obscure.',
    // null, not 0: a quantile of zero still sorts measured entries above
    // unmeasured ones, so only an off switch leaves the pool exactly as it was.
    quantile: null,
  },
  {
    id: 'known',
    label: 'Well-known',
    blurb: 'The more popular half of what you share.',
    quantile: 0.5,
  },
  {
    id: 'popular',
    label: 'Popular',
    blurb: 'The top third. Fewer deep cuts, faster rounds.',
    quantile: 0.7,
  },
  {
    id: 'iconic',
    label: 'Iconic',
    blurb: 'Only the giants. Needs a big shared list to stay varied.',
    quantile: 0.88,
  },
];

export const DEFAULT_POPULARITY_ID = 'any';

const BY_ID = new Map(POPULARITY_LEVELS.map((p) => [p.id, p]));

// Never returns undefined: an id can arrive from a saved room written by an
// older build, and a setup screen that cannot name its own setting renders a
// blank control.
export function getPopularityLevel(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_POPULARITY_ID);
}

// Half the pool. Below this a quantile describes a sample rather than the pool:
// measure 20 of 200 shows and "Popular" cuts the top 30% OF THE 20, so the round
// deals the same six shows forever and nothing on screen looks wrong.
export const MIN_POPULARITY_COVERAGE = 0.5;

// Below this many qualifying shows the setting works and plays badly — the same
// handful of openings every game. Not enforced; popularShowCount exists so the
// setup screen can say so and let the table decide.
export const MIN_POPULARITY_POOL = 5;

/**
 * The popularity an entry has to reach to qualify, or null when the question
 * cannot be answered at all.
 *
 * Null for two different reasons, deliberately collapsed into one so callers
 * have exactly one degraded path rather than three:
 *
 *   1. Nothing carries a popularity — every entry predates the stats.
 *   2. Too few do (MIN_POPULARITY_COVERAGE).
 *
 * The quantile is taken over ONLY the entries carrying a value. Ranking the
 * whole pool would put unmeasured shows at the bottom and quietly turn "the
 * popular half" into "the half that happens to have been imported recently".
 *
 * Null means the filter is skipped and the pool is returned untouched — which is
 * the AniRank release-year bug (a feature keying on a stat absent from older
 * profiles shipped dealing zero cards) avoided by construction rather than by a
 * guard someone can forget.
 */
export function popularityFloor(entries, quantile) {
  if (quantile == null) return null;
  const pool = entries ?? [];
  const values = [];
  for (const entry of pool) {
    const n = entry?.popularity;
    if (n != null && Number.isFinite(n)) values.push(n);
  }
  if (!values.length) return null;
  if (values.length < pool.length * MIN_POPULARITY_COVERAGE) return null;
  values.sort((a, b) => a - b);
  // Nearest-rank, clamped by construction: index 0 is the smallest value, so
  // quantile 0 is "anything measured" and 1 is "only the very top".
  return values[Math.floor((values.length - 1) * quantile)];
}

// Whether a pool can answer the popularity question at all. Defined in terms of
// popularityFloor rather than beside it, so the screen's warning and the filter
// itself can never disagree about what "no data" means — the coverage rule
// included, inherited for free rather than restated.
export const hasPopularitySignal = (entries) => popularityFloor(entries, 0) != null;

// Whether ANY entry carries a value, ignoring the coverage rule. The only caller
// is the warning copy, which has to tell the two dead ends apart: importing more
// lists fixes a partly-measured pool and does nothing for one where the stat was
// never fetched. Not a substitute for hasPopularitySignal — this one says
// nothing about whether the filter will actually run.
export const hasAnyPopularityData = (entries) =>
  (entries ?? []).some((e) => e?.popularity != null && Number.isFinite(e.popularity));

/**
 * The pool a level actually leaves.
 *
 * Returns the input untouched — not an empty array — whenever the floor is null,
 * because "we cannot tell how popular these are" must never read as "none of
 * these are popular enough". That single line is the difference between a dial
 * that does nothing on an old profile and one that deals a round of zero songs.
 */
export function filterByPopularity(entries, levelId = DEFAULT_POPULARITY_ID) {
  const pool = entries ?? [];
  const floor = popularityFloor(pool, getPopularityLevel(levelId).quantile);
  if (floor == null) return pool;
  return pool.filter((e) => e?.popularity != null && e.popularity >= floor);
}

/**
 * How many shows the level leaves, for the setup screen's live readout.
 *
 * Equal to the pool size when the term is inactive, which reads correctly as
 * "this is not narrowing anything". Deliberately not enforced anywhere: a small
 * popular set is a perfectly valid answer to what the user asked for, and
 * silently overriding a setting someone just picked is what makes one feel
 * broken. The screen says so and the table chooses.
 */
export function popularShowCount(entries, levelId = DEFAULT_POPULARITY_ID) {
  return filterByPopularity(entries, levelId).length;
}
