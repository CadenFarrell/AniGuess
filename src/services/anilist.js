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

const CHARACTERS_QUERY = `
query ($id: Int, $page: Int) {
  Media(id: $id, type: ANIME) {
    genres
    characters(sort: [ROLE, FAVOURITES_DESC], perPage: 25, page: $page) {
      pageInfo { hasNextPage }
      edges {
        role
        node {
          id
          name { full }
          gender
          image { large }
          description(asHtml: false)
          favourites
        }
      }
    }
  }
}`;

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

// Fetches characters (paginated) for one anime by AniList media id. Returns
// { genres, edges } — unfiltered; caller applies filterAndMapCharacterEdges
// (src/utils/anilistFormat.js) for the final shape.
//
// Some long-running shows (e.g. Naruto) have 500+ characters — scanning every
// page would mean dozens of rate-limited requests per anime. Since results
// are sorted MAIN-first, then FAVOURITES_DESC within each role, pagination
// can stop the moment we've seen a SUPPORTING character below the caller's
// favourites threshold (everything after is guaranteed lower), or — if the
// caller only wants MAIN characters — the moment SUPPORTING entries begin.
export async function fetchAnimeCharacters(mediaId, {
  signal,
  minSupportingFavourites = 100,
  mainOnly = false,
  maxPages = 12,
} = {}) {
  let genres = null;
  const edges = [];
  let page = 1;
  while (page <= maxPages) {
    const data = await anilistRequest(CHARACTERS_QUERY, { id: mediaId, page }, { signal });
    const media = data?.Media;
    if (!media) break;
    if (!genres) genres = media.genres ?? [];

    const pageEdges = media.characters?.edges ?? [];
    edges.push(...pageEdges);

    const reachedSupporting = pageEdges.some((e) => e.role !== 'MAIN');
    if (mainOnly && reachedSupporting) break;
    const droppedBelowThreshold = pageEdges.some(
      (e) => e.role !== 'MAIN' && (e.node.favourites ?? 0) < minSupportingFavourites
    );
    if (droppedBelowThreshold) break;

    if (!media.characters?.pageInfo?.hasNextPage) break;
    page++;
  }
  return { genres: genres ?? [], edges };
}
