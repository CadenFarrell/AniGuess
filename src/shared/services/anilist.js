import { anilistRequest } from './anilistClient';

const LIST_QUERY = `
query ($userName: String, $type: MediaType, $statusIn: [MediaListStatus]) {
  MediaListCollection(userName: $userName, type: $type, status_in: $statusIn) {
    lists {
      entries {
        status
        media {
          id
          title { romaji english }
          coverImage { large }
        }
      }
    }
  }
}`;

// AniList silently caps the characters connection at 25 per page regardless of
// the perPage we request, so the page size is fixed.
const CHAR_PER_PAGE = 25;

// How many shows to pack into a single aliased request. AniList's query
// complexity cap (500) comfortably allows 20 Media(characters perPage:25)
// aliases in one query; 15 leaves headroom for heavier shows.
const BATCH_SIZE = 15;

// Builds one aliased GraphQL query fetching page `page` of characters for
// several media ids at once (aliases m0..mN). ids are AniList integers, coerced
// with Number() so they are safe to inline into the query string.
function buildBatchCharacterQuery(ids, page) {
  const aliases = ids.map((id, i) => `m${i}: Media(id: ${Number(id)}, type: ANIME) {
    genres
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: ${CHAR_PER_PAGE}, page: ${page}) {
      pageInfo { hasNextPage }
      edges {
        role
        node { id name { full } gender image { large } description(asHtml: false) favourites }
      }
    }
  }`);
  return `query { ${aliases.join('\n')} }`;
}

// Given the edges of a single page, returns true once no later page can hold a
// wanted character. Results are MAIN-first, then FAVOURITES_DESC within each
// role, so once a SUPPORTING entry below the threshold appears (or any
// SUPPORTING appears in mainOnly mode) everything after is guaranteed unwanted.
function reachedCutoff(pageEdges, { mainOnly, minSupportingFavourites }) {
  if (mainOnly) return pageEdges.some((e) => e.role !== 'MAIN');
  return pageEdges.some((e) => e.role !== 'MAIN' && (e.node.favourites ?? 0) < minSupportingFavourites);
}

// Caches raw character pages by `${id}:${page}`. Stored data is unfiltered, so
// it is reused regardless of the caller's favourites/mainOnly settings (those
// only affect client-side filtering, not what we fetch). In-memory only —
// cleared on reload — which sidesteps the storage-quota risk of persisting
// hundreds of KB of character data.
const pageCache = new Map();

// Resolves page `page` of characters for many ids, serving cache hits for free
// and batching the misses into aliased requests of at most `batchSize`. Invokes
// onBatch(Map<id, pageResult>) after each resolution (cache hits up front, then
// once per network round-trip) so callers can advance a progress bar
// incrementally. Returns Map<id, { genres, edges, hasNextPage }>.
async function fetchCharacterPage(ids, page, { signal, batchSize, onBatch }) {
  const out = new Map();
  const misses = [];
  for (const id of ids) {
    const cached = pageCache.get(`${id}:${page}`);
    if (cached) out.set(id, cached);
    else misses.push(id);
  }
  if (out.size > 0) onBatch?.(new Map(out));

  for (let i = 0; i < misses.length; i += batchSize) {
    const chunk = misses.slice(i, i + batchSize);
    const data = await anilistRequest(buildBatchCharacterQuery(chunk, page), {}, { signal });
    const batchOut = new Map();
    chunk.forEach((id, j) => {
      const media = data?.[`m${j}`];
      const result = {
        genres: media?.genres ?? [],
        edges: media?.characters?.edges ?? [],
        hasNextPage: media?.characters?.pageInfo?.hasNextPage ?? false,
      };
      pageCache.set(`${id}:${page}`, result);
      batchOut.set(id, result);
      out.set(id, result);
    });
    onBatch?.(batchOut);
  }
  return out;
}

// Fetches a public AniList user's anime list. Throws a friendly error if the
// username doesn't exist (AniList returns a GraphQL error, not a null result,
// for an unknown user).
export async function fetchUserAnimeList(username, { statusIn = ['COMPLETED'] } = {}) {
  let data;
  try {
    data = await anilistRequest(LIST_QUERY, { userName: username, type: 'ANIME', statusIn });
  } catch (err) {
    if (/not found/i.test(err.message)) {
      throw new Error(`AniList user "${username}" not found.`);
    }
    throw err;
  }

  const collection = data?.MediaListCollection;
  if (!collection) throw new Error(`AniList user "${username}" not found.`);

  const seen = new Map();
  for (const list of collection.lists ?? []) {
    for (const entry of list.entries ?? []) {
      const media = entry.media;
      if (!media || seen.has(media.id)) continue;
      seen.set(media.id, {
        id: media.id,
        title: media.title?.english || media.title?.romaji || `Untitled #${media.id}`,
        coverImageUrl: media.coverImage?.large || '',
        status: entry.status,
      });
    }
  }
  return [...seen.values()];
}

// Fetches characters for many anime at once. Rather than one throttled request
// per show (the AniList API allows only ~30 req/min, so a serial loop is slow),
// this fetches page 1 of every show in a few aliased batch requests, then
// paginates only the rare character-heavy shows whose first page didn't reach
// the cutoff. Returns Map<id, { genres, edges }> — edges accumulated across
// pages and still unfiltered (callers apply filterAndMapCharacterEdges).
//
// onProgress(resolvedCount) reports how many shows are fully done (page 1 for
// most; a few pages only for very character-heavy shows).
export async function fetchManyAnimeCharacters(ids, {
  signal,
  minSupportingFavourites = 100,
  mainOnly = false,
  batchSize = BATCH_SIZE,
  maxPages = 12,
  onProgress,
} = {}) {
  const cutoffOpts = { mainOnly, minSupportingFavourites };
  // id -> { genres, edges, hasNextPage, lastPageEdges, done }
  const state = new Map();

  const settle = (s) => {
    s.done = !s.hasNextPage || reachedCutoff(s.lastPageEdges, cutoffOpts);
  };
  const reportProgress = () => {
    let done = 0;
    for (const s of state.values()) if (s.done) done++;
    onProgress?.(done);
  };

  // Phase 1: page 1 for every show, integrated incrementally so the progress
  // bar advances after each batch request rather than only at the end.
  await fetchCharacterPage(ids, 1, {
    signal,
    batchSize,
    onBatch: (batch) => {
      for (const [id, r] of batch) {
        const s = { genres: r.genres, edges: [...r.edges], hasNextPage: r.hasNextPage, lastPageEdges: r.edges };
        settle(s);
        state.set(id, s);
      }
      reportProgress();
    },
  });

  // Any id AniList didn't return (e.g. an invalid id) won't be in state yet —
  // record it as an empty, finished result so callers still get an entry.
  for (const id of ids) {
    if (!state.has(id)) state.set(id, { genres: [], edges: [], hasNextPage: false, lastPageEdges: [], done: true });
  }
  reportProgress();

  // Phase 2: paginate the stragglers, batched per page level across all shows
  // still active at that page.
  let page = 2;
  while (page <= maxPages) {
    const active = ids.filter((id) => !state.get(id).done);
    if (active.length === 0) break;
    const pageData = await fetchCharacterPage(active, page, { signal, batchSize });
    for (const id of active) {
      const r = pageData.get(id) ?? { edges: [], hasNextPage: false };
      const s = state.get(id);
      s.edges.push(...r.edges);
      s.hasNextPage = r.hasNextPage;
      s.lastPageEdges = r.edges;
      settle(s);
    }
    reportProgress();
    page++;
  }

  const result = new Map();
  for (const [id, s] of state) result.set(id, { genres: s.genres, edges: s.edges });
  return result;
}
