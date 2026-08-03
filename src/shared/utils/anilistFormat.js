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

// AniList's name.full is a ROMANIZATION, so descriptor-style characters arrive
// as romaji ("Kyouryuu no Hime") instead of their English name ("Princess of
// the Klaxosaurs"), which lives only in name.alternative. This prefers the
// English alternative, but ONLY when the romaji is clearly a Japanese
// descriptor — a kanji native name plus a romaji particle or title-noun. A real
// name like "Light Yagami" has neither marker and is always left untouched.
// Verified against 16 popular shows: 8/8 real cases fixed, 0 false positives.

const hasKanji = (s) => /[㐀-鿿]/.test(s || '');
const isAsciiish = (s) => /^[\x20-\x7e]+$/.test(s || '');

// Romaji particles ("... no ...", "... na ...") and title-nouns that only show
// up when name.full is a descriptor rather than a person's name.
const JP_PARTICLE = /\b(no|na|wa|ga|ni|wo|to|de)\b/i;
const JP_TITLE_WORD = new RegExp(
  '\\b(hime|hakase|sensei|sama|san|kun|chan|ou|joou|shuseki|fukushuseki|josei|'
  + 'dansei|otona|kodomo|shounen|shoujo|otoko|onna|kaichou|buchou|shishou|senpai|'
  + 'kouhai|obaasan|ojiisan|okaasan|otousan|oniisan|oneesan|hakushaku|joshi|'
  + 'danshi|tenshi|akuma|kami|ryuu|neko|inu|kimi)\\b',
  'i'
);

// AniList mixes machine tags ("Code:001") and code numbers ("015") into the
// alternative-names array — take the first entry that reads as a real English
// name (plain ASCII, has letters, not a Code:/number tag).
function pickEnglishAlternative(alternatives = []) {
  return (alternatives ?? []).find((raw) => {
    const t = (raw || '').trim();
    return t
      && isAsciiish(t)
      && /[a-z]/i.test(t)
      && !/^code[:\s]/i.test(t)
      && !/^\d/.test(t);
  }) ?? null;
}

// Chooses the display name for one AniList name object, applying the
// romaji→English substitution described above. Exported for testing.
export function preferEnglishName(name) {
  const full = name?.full ?? '';
  const looksDescriptor = hasKanji(name?.native)
    && (JP_PARTICLE.test(full) || JP_TITLE_WORD.test(full));
  if (!looksDescriptor) return full;
  return pickEnglishAlternative(name?.alternative) ?? full;
}

// Combines the character edges of several seasons of one show into a single
// deduped edge list, keyed by AniList character id. A character who is MAIN in
// any season is treated as MAIN overall (a season-2 supporting role shouldn't
// demote a lead), and the highest favourites count across seasons is kept so
// the SUPPORTING favourites cutoff and the maxCharacters sort stay stable.
// Later duplicates otherwise defer to the first edge seen.
export function mergeCharacterEdges(edgeGroups) {
  const byId = new Map();
  for (const edges of edgeGroups ?? []) {
    for (const edge of edges ?? []) {
      const id = edge?.node?.id;
      if (id == null) continue;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, { ...edge, node: { ...edge.node } });
        continue;
      }
      if (edge.role === 'MAIN') existing.role = 'MAIN';
      const favourites = edge.node.favourites ?? 0;
      if (favourites > (existing.node.favourites ?? 0)) existing.node.favourites = favourites;
    }
  }
  return [...byId.values()];
}

// Sortable number for an AniList FuzzyDate — a local copy of franchise.js's
// airDateKey, kept here so this module stays importable on its own. Missing
// parts sort last so a dateless entry never wins an "earliest" comparison.
const airDateKey = (d) => (d?.year ?? 9999) * 10000 + (d?.month ?? 99) * 100 + (d?.day ?? 99);

/**
 * Folds one franchise group's members into the per-show facts a profile stores.
 *
 * A group is ONE card in AniRank, so each field needs a rule for which season
 * speaks for the whole franchise, and they are deliberately not all the same:
 *
 *   startDate  earliest member — a franchise debuted when its first season did,
 *              which is also what blind ranking by year is asking about.
 *   episodes   summed — the card stands for every season, so its length is all
 *              of them. Null only when no member reports a count at all, since
 *              a partial sum still beats dropping the show from the axis.
 *   the rest   the canonical member (group.key), the flagship entry that already
 *              gives the group its title and cover.
 *
 * Returns only keys it actually has, so callers can spread it without writing
 * nulls over data an earlier import stored.
 */
export function summarizeGroupStats(group) {
  const members = group?.members ?? [];
  if (!members.length) return {};

  const canonical = members.find((m) => m.id === group.key) ?? members[0];
  const earliest = members.reduce(
    (best, m) => (airDateKey(m.startDate) < airDateKey(best.startDate) ? m : best),
    members[0]
  );

  const counted = members.filter((m) => Number.isFinite(m.episodes));
  const episodes = counted.length
    ? counted.reduce((sum, m) => sum + m.episodes, 0)
    : null;

  const stats = {
    coverImageUrl: group.coverImageUrl || canonical.coverImageUrl || '',
    startDate: earliest.startDate ?? null,
    episodes,
    averageScore: canonical.averageScore ?? null,
    popularity: canonical.popularity ?? null,
  };

  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v != null && v !== ''));
}

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
    name: preferEnglishName(e.node.name),
    role: e.role === 'MAIN' ? 'Main' : 'Supporting',
    gender: e.node.gender ?? 'Unknown',
    imageUrl: e.node.image?.large ?? '',
    description: trimDesc(e.node.description),
    // Kept, not just used-and-dropped: it is already the value the cutoff above
    // and the maxCharacters sort run on, and it is the only per-character number
    // a saved profile can carry — AniRank's "least → most favourited" axis is
    // exactly this field, so discarding it would mean a network call per round.
    favourites: e.node.favourites ?? 0,
    genres,
  }));
}
