import { describe, it, expect } from 'vitest';
import {
  POPULARITY_LEVELS, DEFAULT_POPULARITY_ID, getPopularityLevel,
  popularityFloor, hasPopularitySignal, hasAnyPopularityData,
  filterByPopularity, popularShowCount, MIN_POPULARITY_COVERAGE,
} from './popularity';

// n shows carrying a popularity, then m carrying none — the shape a profile
// takes when it was imported before the stats existed and partly re-imported
// since.
const measured = (values) => values.map((popularity, i) => ({ id: `m${i}`, title: `M${i}`, popularity }));
const unmeasured = (count) => Array.from({ length: count }, (_, i) => ({ id: `u${i}`, title: `U${i}` }));

describe('getPopularityLevel', () => {
  it('resolves every declared level', () => {
    for (const level of POPULARITY_LEVELS) {
      expect(getPopularityLevel(level.id).id).toBe(level.id);
    }
  });

  // A saved room or prefs blob written by an older build can name a level this
  // one has never heard of; a screen that cannot name its setting renders blank.
  it('falls back rather than returning undefined for an unknown id', () => {
    expect(getPopularityLevel('nonsense').id).toBe(DEFAULT_POPULARITY_ID);
    expect(getPopularityLevel(undefined).id).toBe(DEFAULT_POPULARITY_ID);
  });

  // The default must be the off switch — mergePrefs backfills missing keys, so
  // a filtering default would shrink the pool of every existing player.
  it('defaults to the level that does nothing', () => {
    expect(getPopularityLevel(DEFAULT_POPULARITY_ID).quantile).toBeNull();
  });
});

describe('popularityFloor — the three coverage cases', () => {
  it('returns null when nothing carries a popularity', () => {
    expect(popularityFloor(unmeasured(20), 0.5)).toBeNull();
  });

  // The dangerous case: a signal technically exists, so any `some(pop > 0)`
  // health check reports fine while the quantile describes a tenth of the pool.
  it('returns null when too few do', () => {
    const pool = [...measured([100, 5000, 90000]), ...unmeasured(17)];
    expect(pool.length).toBe(20);
    expect(hasAnyPopularityData(pool)).toBe(true);   // looks healthy...
    expect(popularityFloor(pool, 0.5)).toBeNull();   // ...but is not usable
  });

  it('answers once coverage reaches the threshold', () => {
    const pool = [...measured([10, 20, 30, 40, 50]), ...unmeasured(5)];
    expect(measured([]).length + 5).toBeGreaterThanOrEqual(pool.length * MIN_POPULARITY_COVERAGE);
    expect(popularityFloor(pool, 0)).toBe(10);
  });

  it('ranks only the measured entries, not the whole pool', () => {
    // With five measured values, quantile 0.5 is index floor(4 * 0.5) = 2.
    // Ranking all ten entries would drag the median down to an unmeasured slot.
    const pool = [...measured([10, 20, 30, 40, 50]), ...unmeasured(5)];
    expect(popularityFloor(pool, 0.5)).toBe(30);
  });

  it('takes the top value at quantile 1', () => {
    expect(popularityFloor(measured([10, 20, 30, 40, 50]), 1)).toBe(50);
  });

  it('is off, not a floor of zero, when the quantile is null', () => {
    expect(popularityFloor(measured([10, 20, 30]), null)).toBeNull();
  });

  it('survives an empty or missing pool', () => {
    expect(popularityFloor([], 0.5)).toBeNull();
    expect(popularityFloor(undefined, 0.5)).toBeNull();
  });

  // A genuinely unpopular show has popularity 0, and that is data. AniFake
  // cannot make this distinction because collapseCharacters already defaulted
  // missing to 0; here it survives, so a zero must count toward coverage.
  it('counts a stored zero as measured', () => {
    const pool = measured([0, 0, 0, 0]);
    expect(hasPopularitySignal(pool)).toBe(true);
    expect(popularityFloor(pool, 0.5)).toBe(0);
  });
});

describe('hasPopularitySignal / hasAnyPopularityData', () => {
  it('agree when there is no data at all', () => {
    const pool = unmeasured(10);
    expect(hasAnyPopularityData(pool)).toBe(false);
    expect(hasPopularitySignal(pool)).toBe(false);
  });

  // The reason both exist: only one of these two dead ends is fixed by
  // importing more lists, and the warning copy has to tell them apart.
  it('disagree on a partly measured pool', () => {
    const pool = [...measured([100, 200]), ...unmeasured(18)];
    expect(hasAnyPopularityData(pool)).toBe(true);
    expect(hasPopularitySignal(pool)).toBe(false);
  });
});

describe('filterByPopularity', () => {
  it('narrows a fully measured pool', () => {
    const pool = measured([10, 20, 30, 40, 50]);
    expect(filterByPopularity(pool, 'known').map((e) => e.popularity)).toEqual([30, 40, 50]);
  });

  it('leaves the pool alone at the default level', () => {
    const pool = measured([10, 20, 30]);
    expect(filterByPopularity(pool, DEFAULT_POPULARITY_ID)).toBe(pool);
  });

  // The whole point of the null path. A pre-stats profile must play a normal
  // round, not a round of nothing — this is the AniRank release-year bug.
  it('returns an unmeasurable pool untouched rather than emptying it', () => {
    const pool = unmeasured(12);
    expect(filterByPopularity(pool, 'iconic')).toBe(pool);
    expect(popularShowCount(pool, 'iconic')).toBe(12);
  });

  it('returns a partly measured pool untouched too', () => {
    const pool = [...measured([100, 200]), ...unmeasured(18)];
    expect(filterByPopularity(pool, 'iconic').length).toBe(20);
  });

  it('drops unmeasured entries once the filter is actually running', () => {
    const pool = [...measured([10, 20, 30, 40, 50, 60]), ...unmeasured(2)];
    const kept = filterByPopularity(pool, 'known');
    expect(kept.every((e) => e.popularity != null)).toBe(true);
  });

  it('survives an empty pool', () => {
    expect(popularShowCount([], 'iconic')).toBe(0);
    expect(popularShowCount(undefined, 'iconic')).toBe(0);
  });
});
