// Builds the ten shows a round is played with. Pure and offline: every field it
// reads is already on a saved profile, so local play touches no network — the
// property CLAUDE.md asks callers to preserve.
import { franchiseTitleKey } from '../../../shared/utils/franchise';
import { shuffle } from '../../../shared/utils/random';
import { BOARD_SIZE } from '../rules';

// The only numeric ground truth a stored profile carries. AniList's
// averageScore and popularity are never imported (see shared/services/anilist.js
// — the stored anime shape is id/title/coverImageUrl/status/format/startDate/
// relatedIds), so ranking by anything else would mean a network call per round
// and a game that could not be played offline.
export function yearOf(anime) {
  const year = anime?.startDate?.year;
  return Number.isInteger(year) && year > 1900 ? year : null;
}

// One entry per franchise. Grouped by title rather than by AniList relations
// because this runs against an already-saved profile, where relation data is
// long gone — franchiseTitleKey is the offline half of shared/utils/franchise.js.
//
// Without this a four-season run puts four near-identical years on the board and
// the round turns into a memory test about which season was which.
function collapseFranchises(animeList) {
  const byFranchise = new Map();
  for (const anime of animeList || []) {
    const year = yearOf(anime);
    if (!year) continue;
    const key = franchiseTitleKey(anime.title);
    if (!key) continue;
    const existing = byFranchise.get(key);
    // Keep the earliest season: it is the one people actually date, and it is
    // stable regardless of which seasons happen to be on a given profile.
    if (!existing || year < existing.year) {
      byFranchise.set(key, { key, title: anime.title, year, coverImageUrl: anime.coverImageUrl || '' });
    }
  }
  return byFranchise;
}

/**
 * The shows eligible for a round.
 *
 * sharedOnly keeps only franchises every player has, matching AniTune rather
 * than AniGuess: everyone ranks the same ten shows at the same time, so a show
 * only one player has seen is a guaranteed blind guess for the rest.
 *
 * Returns entries as { id, title, year, coverImageUrl } — `id` is the franchise
 * key, which is what makes a show identifiable across two players' differently
 * spelled list titles.
 */
export function eligibleShows(players, { sharedOnly = true } = {}) {
  if (!players?.length) return [];

  const counts = new Map(); // franchise key -> { entry, owners }
  for (const player of players) {
    for (const [key, entry] of collapseFranchises(player.animeList)) {
      if (!counts.has(key)) counts.set(key, { entry, owners: new Set() });
      const slot = counts.get(key);
      slot.owners.add(player.id);
      // Prefer the earliest year seen across players, so two lists disagreeing
      // about which season they saved can't change the answer.
      if (entry.year < slot.entry.year) slot.entry = entry;
    }
  }

  const kept = [...counts.values()]
    .filter((c) => !sharedOnly || c.owners.size === players.length)
    .map((c) => c.entry);

  return kept.map((e) => ({
    id: e.key,
    title: e.title,
    year: e.year,
    coverImageUrl: e.coverImageUrl,
  }));
}

/**
 * Draws a round.
 *
 * Returns { deck, candidates, enough }. `candidates` and `enough` exist so the
 * setup screen can say *why* it will not start — with a small shared list this
 * is the ordinary failure, not an edge case, and AniTune's "No playable songs
 * found" is the precedent for explaining it rather than disabling a button.
 */
export function buildDeck(players, { size = BOARD_SIZE, sharedOnly = true, rng = Math.random } = {}) {
  const candidates = eligibleShows(players, { sharedOnly });
  if (candidates.length < size) {
    return { deck: [], candidates: candidates.length, enough: false };
  }
  return { deck: shuffle(candidates, rng).slice(0, size), candidates: candidates.length, enough: true };
}
