// Low-level AniList GraphQL client for the browser. Throttles requests based
// on the X-RateLimit-* headers AniList actually returns (the commonly-cited
// ~90/min figure is stale — as of writing the API reports a 30 req/min limit)
// and backs off on 429 using Retry-After / X-RateLimit-Reset.
//
// Despite "for the browser" above, this module is plain fetch plus timers and is
// Node-safe — generateFacts.js imports it directly. Do that rather than copying
// the throttle: generateProfiles.js has its own 600ms version only because it
// predates this file, and a third copy is how a rate-limit fix ends up applied
// to two callers out of three.
//
// Two Node caveats bite, not one. animethemesClient.js's User-Agent bot filter
// is a different API; AniList has its own, on Referer — see REFERER below.
const ENDPOINT = 'https://graphql.anilist.co';

// AniList bot-filters requests that carry no Referer, answering them with a 403
// whose body reads "The AniList API has been temporarily disabled due to severe
// stability issues." That looks exactly like an outage and was mistaken for one:
// the fact pack shipped empty because generateFacts.js could not get a single
// response. Only the header's PRESENCE is checked — any non-empty value passes,
// and an empty one does not — so this is honest about who is calling rather
// than impersonating anilist.co.
//
// It is a no-op in the browser: Referer is a forbidden header name, so fetch()
// silently drops this and sends the page's own referrer, which is why the app's
// import kept working throughout and only Node was ever blocked.
const REFERER = 'https://aniguess-a08f7.web.app/';
const FALLBACK_MIN_INTERVAL_MS = 2500; // ~24 req/min, safe even if headers are ever absent

let lastRequestAt = 0;
let minIntervalMs = FALLBACK_MIN_INTERVAL_MS;

async function throttle() {
  const wait = minIntervalMs - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function updateThrottleFromHeaders(res) {
  const limit = Number(res.headers.get('X-RateLimit-Limit'));
  if (Number.isFinite(limit) && limit > 0) {
    // Stay under the limit with a small safety margin.
    minIntervalMs = Math.max(Math.ceil(60000 / limit) + 200, 300);
  }
}

export async function anilistRequest(query, variables, { signal } = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await throttle();

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Referer: REFERER,
        },
        body: JSON.stringify({ query, variables }),
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (attempt === 4) throw new Error(`AniList request failed: ${err.message}`);
      continue;
    }

    updateThrottleFromHeaders(res);

    if (res.status === 429) {
      const retryAfterSec = Number(res.headers.get('Retry-After'));
      const resetAtSec = Number(res.headers.get('X-RateLimit-Reset'));
      const waitMs = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : Number.isFinite(resetAtSec)
          ? Math.max(resetAtSec * 1000 - Date.now(), 1000)
          : 60000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    const json = await res.json().catch(() => null);
    if (!res.ok || json?.errors) {
      const message = json?.errors?.[0]?.message || `HTTP ${res.status}`;
      throw new Error(`AniList error: ${message}`);
    }

    return json.data;
  }
  throw new Error('AniList request failed after retries');
}
