// Builds the ten cards a round is played with. Pure and offline: every field it
// reads is already on a saved profile, so local play touches no network — the
// property CLAUDE.md asks callers to preserve.
//
// Two pools, chosen by the axis (see ../axes.js): the shows on a profile, or the
// characters inside them. Both end up as the same card shape, so rules.js and
// RankBoard never learn which one they are holding:
//
//   { id, title, subtitle, imageUrl, value }
//
// `value` is the number the axis ranks by, already extracted — null on an
// opinion axis, where there is nothing objective to sort. Stamping it here is
// what keeps rules.js free of any knowledge of what is being ranked.
import { characterNameKey, normalizeCharacter } from '../../../shared/utils/character';
import { franchiseTitleKey } from '../../../shared/utils/franchise';
import { shuffle } from '../../../shared/utils/random';
import { BOARD_SIZE } from '../rules';
import { getAxis } from '../axes';

// One entry per franchise. Grouped by title rather than by AniList relations
// because this runs against an already-saved profile, where relation data is
// long gone — franchiseTitleKey is the offline half of shared/utils/franchise.js.
//
// Without this a four-season run puts four near-identical cards on the board and
// the round turns into a memory test about which season was which.
function collapseFranchises(animeList, axis) {
  const byFranchise = new Map();
  for (const anime of animeList || []) {
    const key = franchiseTitleKey(anime.title);
    if (!key) continue;
    const value = axis.kind === 'fact' ? axis.valueFor(anime) : null;
    // A fact axis needs its number, and an entry saved before the import carried
    // one simply is not eligible for THIS axis — it may still be for another.
    if (axis.kind === 'fact' && value == null) continue;

    const existing = byFranchise.get(key);
    // Keep the lowest-valued season: for the year axis that is the franchise's
    // debut, which is the one people actually date and is stable regardless of
    // which seasons happen to be on a given profile.
    const better = !existing
      || (value != null && existing.value != null && value < existing.value);
    if (better) {
      byFranchise.set(key, {
        id: key,
        title: anime.title,
        subtitle: '',
        imageUrl: anime.coverImageUrl || '',
        value,
      });
    }
  }
  return byFranchise;
}

// One entry per character, keyed by folded name so the same person listed under
// three season titles is one card — the same identity rule AniGuess uses, and
// the reason ids are not used (AniList ids and ListManager's Date.now() ids
// share no id space, and the same person appears under several season titles).
function collapseCharacters(animeList, axis) {
  const byName = new Map();
  for (const anime of animeList || []) {
    for (const raw of anime.characters || []) {
      const char = normalizeCharacter(raw);
      const key = characterNameKey(char?.name);
      if (!key) continue;
      const value = axis.kind === 'fact' ? axis.valueFor(char) : null;
      if (axis.kind === 'fact' && value == null) continue;

      const existing = byName.get(key);
      // Keep the best-known copy: the highest favourites count is the one
      // mergeCharacterEdges already settled on across seasons, and a copy with a
      // portrait beats one without, since the card renders it.
      const better = !existing
        || (value != null && existing.value != null && value > existing.value)
        || (!existing.imageUrl && !!char.imageUrl);
      if (better) {
        byName.set(key, {
          id: key,
          title: char.name,
          subtitle: anime.title || '',
          imageUrl: char.imageUrl || '',
          value,
        });
      }
    }
  }
  return byName;
}

/**
 * The cards eligible for a round.
 *
 * sharedOnly keeps only entries every player has, matching AniTune rather than
 * AniGuess: everyone ranks the same ten cards at the same time, so a card only
 * one player has seen is a guaranteed blind guess for the rest.
 */
export function eligibleItems(players, { axis, sharedOnly = true } = {}) {
  if (!players?.length) return [];
  const resolved = getAxis(axis?.id ?? axis);
  const collapse = resolved.items === 'characters' ? collapseCharacters : collapseFranchises;

  const counts = new Map(); // key -> { entry, owners }
  for (const player of players) {
    for (const [key, entry] of collapse(player.animeList, resolved)) {
      if (!counts.has(key)) counts.set(key, { entry, owners: new Set() });
      const slot = counts.get(key);
      slot.owners.add(player.id);
      // Prefer the lowest value seen across players, so two lists disagreeing
      // about which season they saved can't change the answer.
      if (entry.value != null && slot.entry.value != null && entry.value < slot.entry.value) {
        slot.entry = entry;
      }
    }
  }

  return [...counts.values()]
    .filter((c) => !sharedOnly || c.owners.size === players.length)
    .map((c) => c.entry);
}

/**
 * Draws a round.
 *
 * Returns { deck, candidates, enough }. `candidates` and `enough` exist so the
 * setup screen can say *why* it will not start — with a small shared list, or an
 * axis whose field no profile has been re-imported for, this is the ordinary
 * failure rather than an edge case, and AniTune's "No playable songs found" is
 * the precedent for explaining it rather than disabling a button.
 */
export function buildDeck(players, {
  axis, size = BOARD_SIZE, sharedOnly = true, rng = Math.random,
} = {}) {
  const candidates = eligibleItems(players, { axis, sharedOnly });
  if (candidates.length < size) {
    return { deck: [], candidates: candidates.length, enough: false };
  }
  return { deck: shuffle(candidates, rng).slice(0, size), candidates: candidates.length, enough: true };
}
