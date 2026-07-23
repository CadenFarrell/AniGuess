// Ties the pieces together: players' anime lists -> AnimeThemes matches ->
// themes -> a playable round. This is the only place in AniTune that does
// network work on behalf of the game loop; questionPool.js holds the rules.
import { resolveAnimeEntry } from './resolveAnime';
import { fetchAnimeThemes } from './animethemesClient';
import { storage } from '../../../shared/services/storage';
import { getEligibleAnimeList, buildQuestionPool, pickRound } from '../utils/questionPool';

// Themes change rarely, so cache them per slug and skip the round trip on
// later games. Separate from the resolution cache: that one maps titles to
// slugs, this one holds the payload.
const THEME_CACHE_KEY = 'anitune_theme_cache';
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
  allowSpoilers = false,
  allowNsfw = false,
  roundSize = 10,
  maxPerAnime = 2,
  signal,
  onProgress,
} = {}) {
  const eligible = getEligibleAnimeList(players, { sharedSongsOnly });

  const resolvedAnime = [];
  const unresolved = [];
  const themeless = [];

  // Stage 1 — map each title onto an AnimeThemes anime.
  let done = 0;
  const resolutions = [];
  for (const entry of eligible) {
    let resolved = null;
    try {
      resolved = await resolveAnimeEntry(entry, { signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
    if (resolved) resolutions.push({ entry, resolved });
    else unresolved.push(entry);
    done += 1;
    onProgress?.({ phase: 'resolving', done, total: eligible.length, entry });
  }

  // Stage 2 — pull each match's themes.
  done = 0;
  for (const { entry, resolved } of resolutions) {
    let themes = [];
    try {
      themes = await getThemes(resolved.slug, { signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
    if (themes.length) resolvedAnime.push({ entry, resolved, themes });
    else themeless.push(entry);
    done += 1;
    onProgress?.({ phase: 'themes', done, total: resolutions.length, entry });
  }

  const questions = buildQuestionPool(resolvedAnime, {
    includeOpenings, includeEndings, allowSpoilers, allowNsfw,
  });

  return {
    questions,
    round: pickRound(questions, { count: roundSize, maxPerAnime }),
    eligible,
    unresolved,
    themeless,
  };
}

export function clearThemeCache() {
  storage.removeItem(THEME_CACHE_KEY);
}
