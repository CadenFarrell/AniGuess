// Maps a player's profile anime entry onto an AnimeThemes anime, so the
// opening quiz knows which themes belong to which show.
//
// Two routes in, in order of trust:
//
//   1. AniList id. Entries added by the AniList import carry it in their id
//      (`anilist_anime_<id>`, see shared/utils/profileMerge.js), and
//      AnimeThemes indexes AniList directly — an exact, unambiguous lookup.
//
//   2. Title search. Everything else (hand-added and seeded entries) has only
//      an English title. The API's search does the English->romaji work well
//      ("Demon Slayer" finds "Kimetsu no Yaiba"), but its *ordering* is not
//      trustworthy, so we re-rank — see scoreCandidate.
//
// Resolution is deliberately a one-time step whose result is cached, not
// something the game does per question: route 2 is fuzzy, and re-running it
// live would make the same guess repeatedly at 750ms a pop.
import { storage } from '../../../shared/services/storage';
import { searchAnime, findAnimeByAniListId } from './animethemesClient';
import { normalizeTitle, extractAniListId, pickBestCandidate } from './matchAnime';

export { normalizeTitle, extractAniListId, scoreCandidate, pickBestCandidate } from './matchAnime';

const CACHE_KEY = 'anitune_animethemes_map';

function loadCache() {
  return storage.getItem(CACHE_KEY) || {};
}

function saveCache(cache) {
  storage.setItem(CACHE_KEY, cache);
}

function cacheKeyFor(entry) {
  const anilistId = extractAniListId(entry.id);
  return anilistId ? `anilist:${anilistId}` : `title:${normalizeTitle(entry.title)}`;
}

/**
 * Resolves one profile anime entry to an AnimeThemes anime.
 *
 * Returns { slug, name, mediaFormat, year, matchType, confidence } or null.
 * matchType is 'anilist' | 'exact' | 'fuzzy' — anything but 'anilist' and
 * 'exact' is a guess worth showing the user before it is trusted.
 */
export async function resolveAnimeEntry(entry, { signal, useCache = true } = {}) {
  const key = cacheKeyFor(entry);
  const cache = loadCache();
  if (useCache && cache[key]) return cache[key];

  let resolved = null;

  const anilistId = extractAniListId(entry.id);
  if (anilistId) {
    const anime = await findAnimeByAniListId(anilistId, { signal });
    if (anime) {
      resolved = {
        slug: anime.slug,
        name: anime.name,
        mediaFormat: anime.media_format,
        year: anime.year,
        matchType: 'anilist',
        confidence: 1,
      };
    }
  }

  if (!resolved) {
    const candidates = await searchAnime(entry.title, { signal });
    const best = pickBestCandidate(candidates, entry.title);
    if (best) {
      const exact = normalizeTitle(best.candidate.name) === normalizeTitle(entry.title);
      resolved = {
        slug: best.candidate.slug,
        name: best.candidate.name,
        mediaFormat: best.candidate.media_format,
        year: best.candidate.year,
        matchType: exact ? 'exact' : 'fuzzy',
        // Rough 0..1 signal for surfacing shaky matches in the UI. The score
        // is unbounded in principle but tops out around 100 in practice.
        confidence: exact ? 1 : Math.min(best.score / 100, 0.95),
      };
    }
  }

  // Cache misses too, so a title with genuinely no match is not retried on
  // every visit. `resolved: null` is a real answer.
  cache[key] = resolved;
  saveCache(cache);
  return resolved;
}

/**
 * Resolves a whole animeList. Sequential on purpose — the client throttles to
 * stay under the rate limit, so firing these in parallel would only queue them
 * behind each other while making cancellation messier.
 *
 * onProgress({ done, total, entry, resolved }) fires after each entry.
 * Returns Map<entryId, resolved|null>.
 */
export async function resolveAnimeList(animeList, { signal, onProgress, useCache = true } = {}) {
  const results = new Map();
  const total = animeList.length;
  let done = 0;

  for (const entry of animeList) {
    let resolved = null;
    try {
      resolved = await resolveAnimeEntry(entry, { signal, useCache });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // One bad title should not abandon the whole list; record the miss and
      // carry on.
      resolved = null;
    }
    results.set(entry.id, resolved);
    done += 1;
    onProgress?.({ done, total, entry, resolved });
  }

  return results;
}

// Lets the user correct a bad fuzzy match without re-resolving everything.
export function overrideResolution(entry, resolved) {
  const cache = loadCache();
  cache[cacheKeyFor(entry)] = resolved ? { ...resolved, matchType: 'manual', confidence: 1 } : null;
  saveCache(cache);
}

export function clearResolutionCache() {
  storage.removeItem(CACHE_KEY);
}
