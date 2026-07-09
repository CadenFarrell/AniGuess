// Low-level AniList GraphQL client for the browser. Throttles requests based
// on the X-RateLimit-* headers AniList actually returns (the commonly-cited
// ~90/min figure is stale — as of writing the API reports a 30 req/min limit)
// and backs off on 429 using Retry-After / X-RateLimit-Reset.
const ENDPOINT = 'https://graphql.anilist.co';
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
