// Pure title-matching logic for AnimeThemes search results. No imports and no
// I/O, so it can be reasoned about and exercised directly; resolveAnime.js
// wraps it with network calls and caching.

// Formats that represent a main TV run. The correct answer for a franchise
// query is almost always one of these; movies, OVAs and specials are the
// spin-offs that pollute search results.
const FORMAT_SCORES = {
  TV: 30,
  ONA: 22,
  'TV Short': 6,
  Movie: 0,
  OVA: 0,
  Special: 0,
};

// Markers that identify a later season/cour rather than the first run. A bare
// English query ("Code Geass") almost always means season 1, but the API is
// happy to return R2 or Part 2, so these are penalised. Deliberately narrow —
// it must not fire on words that are simply part of a title.
const SEQUEL_MARKERS = [
  /\b(2nd|3rd|4th|5th)\b/i,
  /\bseason\s*\d/i,
  /\bpart\s*\d/i,
  /\bcour\s*\d/i,
  /\b(II|III|IV)\b/,
  /\bR2\b/i,
  /√A/,
  /\bfinal\s+season\b/i,
];

function isSequel(name) {
  return SEQUEL_MARKERS.some((re) => re.test(name || ''));
}

export function normalizeTitle(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Pulls the AniList media id out of an entry id like `anilist_anime_21`.
// Returns null for hand-added entries (`gavin_anime_0`) which carry no id.
export function extractAniListId(entryId) {
  const match = /^anilist_anime_(\d+)$/.exec(entryId || '');
  return match ? Number(match[1]) : null;
}

// Ranks one search candidate for a query. The API's own ordering is a real
// relevance signal (it is what bridges English to romaji) but it routinely
// puts a spin-off first: "Re:Zero" returns the Memory Snow *movie* ahead of
// the TV series, and "Demon Slayer" returns an unrelated short called
// "Onigiri" at position 0. Combining API rank with format and an explicit
// year hint fixes both.
export function scoreCandidate(candidate, query, index) {
  const normQuery = normalizeTitle(query);
  const normName = normalizeTitle(candidate.name);

  // An exact name match is decisive; nothing should outrank it.
  if (normName === normQuery) return 1000;

  let score = 0;

  // Decaying trust in the API's ordering.
  score += Math.max(0, 25 - index * 5);

  score += FORMAT_SCORES[candidate.media_format] ?? 5;

  // A year in the title ("Fate/Stay Night (2006)") is an explicit
  // disambiguator, so weight it heavily when it lines up.
  const queryYear = /(19|20)\d{2}/.exec(query || '');
  if (queryYear && Number(queryYear[0]) === candidate.year) score += 40;

  // Prefer the base entry over sequels and arc titles, which are longer.
  // Small, so it only breaks ties.
  score += Math.max(0, 8 - Math.floor((candidate.name || '').length / 12));

  // A candidate that starts with the query is likelier than one that merely
  // contains it. Only meaningful when the title is already romaji.
  if (normQuery && normName.startsWith(normQuery)) score += 12;

  // Only penalise a sequel when the query itself does not ask for one — a
  // search for "Attack on Titan Final Season" should still find it. Sized to
  // outweigh a full position bonus: the API ranks "Code Geass ... R2" 5 slots
  // above season 1, and a bare "Code Geass" means season 1.
  if (isSequel(candidate.name) && !isSequel(query)) score -= 25;

  return score;
}

export function pickBestCandidate(candidates, query) {
  let best = null;
  let bestScore = -Infinity;
  candidates.forEach((candidate, index) => {
    const score = scoreCandidate(candidate, query, index);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });
  return best ? { candidate: best, score: bestScore } : null;
}
