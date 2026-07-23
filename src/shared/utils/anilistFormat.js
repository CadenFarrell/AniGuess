// Pure, framework- and Node-free formatting/filtering logic for AniList character
// data. Shared by generateProfiles.js (Node dev script) and src/shared/services/anilist.js
// (browser import flow) so both paths produce identical character shapes.

export const trimDesc = (desc = '') => {
  const t = (desc || '')
    .replace(/~!.*?!~/gs, '')                    // strip spoiler tags
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1') // [text](url) → text
    .replace(/<br\s*\/?>/gi, ' ')                // <br> tags
    .replace(/&quot;/g, '"')                     // HTML entities
    .replace(/&#039;/g, "'")                     // HTML entities
    .replace(/&amp;/g, '&')                      // HTML entities
    .replace(/__(.*?)__/g, '$1')                 // __bold__ → plain
    .replace(/\*\*(.*?)\*\*/g, '$1')             // **bold** → plain
    .replace(/\(Source:[^)]*\)/gi, '')           // (Source: ...) attribution
    .replace(/^[^.!?\n]*?\b[A-Z][\w\s]+:[^\n]*(\n|$)/gm, '') // stat/label lines (e.g. Height:, Affiliation:)
    .replace(/\n+/g, ' ')                        // newlines → space
    .replace(/\s{2,}/g, ' ')                     // collapse extra spaces
    .trim();
  if (t.length <= 280) return t;
  const cut = t.slice(0, 280);
  const lastSentence = cut.search(/[^.!?]*$/);
  return cut.slice(0, lastSentence).trim();
};

// Filters AniList character edges down to MAIN + high-favourite SUPPORTING,
// optionally caps the result (sorted by favourites) and maps into the shape
// normalizeCharacter (src/shared/utils/character.js) already expects.
export function filterAndMapCharacterEdges(edges, {
  minSupportingFavourites = 100,
  mainOnly = false,
  maxCharacters = Infinity,
  genres = [],
} = {}) {
  const filtered = edges.filter(e =>
    e.role === 'MAIN' ||
    (!mainOnly && e.role === 'SUPPORTING' && (e.node.favourites ?? 0) >= minSupportingFavourites)
  );

  const capped = Number.isFinite(maxCharacters) && filtered.length > maxCharacters
    ? [...filtered].sort((a, b) => (b.node.favourites ?? 0) - (a.node.favourites ?? 0)).slice(0, maxCharacters)
    : filtered;

  return capped.map(e => ({
    id: `anilist_${e.node.id}`,
    name: e.node.name.full,
    role: e.role === 'MAIN' ? 'Main' : 'Supporting',
    gender: e.node.gender ?? 'Unknown',
    imageUrl: e.node.image?.large ?? '',
    description: trimDesc(e.node.description),
    genres,
  }));
}
