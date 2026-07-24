// Low-level AnimeThemes.moe client for the browser. No auth or API key — the
// whole API is public. Throttles from the x-ratelimit-limit header the API
// actually returns (90/min as of writing) and backs off on 429.
//
// Two things learned the hard way, both verified against the live API:
//
//  1. The API bot-filters on User-Agent. A request with no UA (Node's built-in
//     fetch) gets a 403 HTML error page instead of JSON, which parses as a
//     confusing SyntaxError rather than an obvious failure. Browsers send a
//     real UA so this is a non-issue here, but any Node-side script using this
//     module must set one — fetch() in the browser cannot set User-Agent at
//     all (it is a forbidden header), so we rely on the browser's own.
//
//  2. The audio CDN (a.animethemes.moe) answers OPTIONS preflight with CORS
//     headers but omits them on the actual GET. Plain <audio src> playback and
//     Range seeking both work; fetch()/decodeAudioData/crossOrigin="anonymous"
//     do not. Do not try to pull audio bytes into JS without a proxy.
const ENDPOINT = 'https://api.animethemes.moe';
const FALLBACK_MIN_INTERVAL_MS = 750; // ~80 req/min, under the observed 90 limit

let lastRequestAt = 0;
let minIntervalMs = FALLBACK_MIN_INTERVAL_MS;

async function throttle(signal) {
  const wait = minIntervalMs - (Date.now() - lastRequestAt);
  if (wait > 0) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, wait);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }
  lastRequestAt = Date.now();
}

function updateThrottleFromHeaders(res) {
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  if (Number.isFinite(limit) && limit > 0) {
    minIntervalMs = Math.max(Math.ceil(60000 / limit) + 100, 300);
  }
}

// `params` values are encoded as-is; bracketed keys like 'filter[site]' are
// what the API expects, so callers pass them literally.
export async function animethemesRequest(path, params = {}, { signal } = {}) {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, ENDPOINT);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    await throttle(signal);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (attempt === 4) throw new Error(`AnimeThemes request failed: ${err.message}`);
      continue;
    }

    updateThrottleFromHeaders(res);

    if (res.status === 429 || res.status >= 500) {
      const retryAfterSec = Number(res.headers.get('Retry-After'));
      const waitMs = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : Math.min(1000 * 2 ** attempt, 30000);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // A 403 here is almost always the bot filter (see note 1 above) and the
    // body is HTML, so surface it as something recognisable rather than
    // letting res.json() throw a bare SyntaxError.
    if (res.status === 403) {
      throw new Error('AnimeThemes returned 403 (likely User-Agent bot filter)');
    }

    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      throw new Error(`AnimeThemes error: HTTP ${res.status}`);
    }
    return json;
  }
  throw new Error('AnimeThemes request failed after retries');
}

// Free-text search. The API does the English->romaji work ("Demon Slayer"
// finds "Kimetsu no Yaiba"), but its ordering is unreliable — see
// scoreCandidate in resolveAnime.js.
export async function searchAnime(query, { signal } = {}) {
  const json = await animethemesRequest('/search', {
    q: query,
    'fields[search]': 'anime',
  }, { signal });
  return json?.search?.anime ?? [];
}

// Exact lookup by AniList media id. AnimeThemes stores AniList alongside
// MyAnimeList/AniDB/Kitsu as an external "resource", so no MAL hop is needed.
export async function findAnimeByAniListId(anilistId, { signal } = {}) {
  const json = await animethemesRequest('/resource', {
    'filter[site]': 'AniList',
    'filter[external_id]': anilistId,
    include: 'anime',
  }, { signal });

  // The endpoint returns one row per matching resource and some carry an empty
  // anime array (the same external id can be attached to non-anime records),
  // so take the first row that actually resolved to an anime.
  for (const resource of json?.resources ?? []) {
    const anime = resource?.anime?.[0];
    if (anime) return anime;
  }
  return null;
}

// Themes for one anime, with the audio file attached. Keyed by slug, not by
// numeric id — /anime/{id} is a 404, the show route wants /anime/{slug}.
// Returns the raw anime object including `animethemes`.
export async function fetchAnimeThemes(slug, { signal } = {}) {
  const json = await animethemesRequest(`/anime/${encodeURIComponent(slug)}`, {
    include: 'animethemes.animethemeentries.videos.audio,animethemes.song',
  }, { signal });
  return json?.anime ?? null;
}
