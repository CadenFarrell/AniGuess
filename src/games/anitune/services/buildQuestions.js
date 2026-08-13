// Ties the pieces together: players' anime lists -> AnimeThemes matches ->
// themes -> a playable round. This is the only place in AniTune that does
// network work on behalf of the game loop; questionPool.js holds the rules.
import { resolveAnimeEntry } from './resolveAnime';
import { fetchAnimeThemes } from './animethemesClient';
import { storage } from '../../../shared/services/storage';
import {
  eligibleEntries, buildQuestionPool, pickRound, DEFAULT_SAMPLE_POINT, YEAR_MIN, YEAR_MAX,
} from '../utils/questionPool';
import { DEFAULT_POPULARITY_ID } from '../utils/popularity';

// Themes change rarely, so cache them per slug and skip the round trip on
// later games. Separate from the resolution cache: that one maps titles to
// slugs, this one holds the payload.
//
// The key is versioned because the cached value is a *shape*, not just data. A
// 14-day TTL means widening the API include — artists, most recently — would
// otherwise reach nobody who had played in the past fortnight: they would get
// the new reveal with none of the new fields in it, which looks like the feature
// silently not working. Bump the suffix whenever fetchAnimeThemes' include
// changes.
const THEME_CACHE_KEY = 'anitune_theme_cache_v2';
const THEME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function loadThemeCache() {
  return storage.getItem(THEME_CACHE_KEY) || {};
}

async function getThemes(slug, { signal } = {}) {
  const cache = loadThemeCache();
  const hit = cache[slug];
  if (hit && Date.now() - hit.cachedAt < THEME_CACHE_TTL_MS) return hit.themes;

  const anime = await fetchAnimeThemes(slug, { signal });
  const themes = anime?.animethemes || [];
  cache[slug] = { themes, cachedAt: Date.now() };
  storage.setItem(THEME_CACHE_KEY, cache);
  return themes;
}

/**
 * Prepares everything needed to play.
 *
 * Both network stages are throttled by the client, so a first run over a large
 * shared library takes a while — onProgress reports {phase, done, total} so
 * the UI can show it rather than appearing hung. Later runs are near-instant
 * off the two caches.
 *
 * Returns { questions, round, eligible, unresolved, themeless }.
 * `unresolved` and `themeless` are surfaced so the setup screen can tell the
 * player which of their shows AniTune cannot use, instead of silently
 * dropping them.
 */
export async function prepareQuestions(players, {
  sharedSongsOnly = true,
  includeOpenings = true,
  includeEndings = true,
  popularity = DEFAULT_POPULARITY_ID,
  yearFrom = YEAR_MIN,
  yearTo = YEAR_MAX,
  samplePoint = DEFAULT_SAMPLE_POINT,
  roundSize = 10,
  maxPerAnime = 2,
  signal,
  onProgress,
} = {}) {
  // Every pool filter is applied here, before a single request goes out — the
  // dials narrow what gets resolved, so a tight setting also makes the first
  // run dramatically faster rather than fetching everything and discarding most
  // of it.
  const entries = eligibleEntries(players, {
    sharedSongsOnly, popularity, yearFrom, yearTo,
  });

  const resolvedAnime = [];
  const unresolved = [];
  const themeless = [];

  // Stage 1 — map each title onto an AnimeThemes anime.
  let done = 0;
  const resolutions = [];
  for (const { anime: entry, owners } of entries) {
    let resolved = null;
    try {
      resolved = await resolveAnimeEntry(entry, { signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
    if (resolved) resolutions.push({ entry, resolved, owners });
    else unresolved.push(entry);
    done += 1;
    onProgress?.({ phase: 'resolving', done, total: entries.length, entry });
  }

  // Stage 2 — pull each match's themes.
  done = 0;
  for (const { entry, resolved, owners } of resolutions) {
    let themes = [];
    try {
      themes = await getThemes(resolved.slug, { signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
    if (themes.length) resolvedAnime.push({ entry, resolved, themes, owners });
    else themeless.push(entry);
    done += 1;
    onProgress?.({ phase: 'themes', done, total: resolutions.length, entry });
  }

  const questions = buildQuestionPool(resolvedAnime, { includeOpenings, includeEndings });

  return {
    questions,
    round: pickRound(questions, { count: roundSize, maxPerAnime, samplePoint }),
    eligible: entries.map((e) => e.anime),
    unresolved,
    themeless,
  };
}

export function clearThemeCache() {
  storage.removeItem(THEME_CACHE_KEY);
}
