// Groups AniList media that are really the same show into one franchise, so a
// four-season run stops arriving as four separate entries with four copies of
// the same cast. Pure — the AniList shapes it touches are just
// { id, title, coverImageUrl, format, startDate, relatedIds }.
//
// Two ways to decide "same show", used in different places:
//   groupIntoFranchises — AniList relation data. Accurate, but only available
//     during an import.
//   franchiseTitleKey   — the title alone. A heuristic, but it works offline on
//     a profile that was saved before any of this existed.

import { normalizeTitle } from './ranking';

// The relations that mean "same show, later/earlier/attached part": season
// chains (PREQUEL/SEQUEL) and the OVAs and specials hanging off a season
// (PARENT/SIDE_STORY). Deliberately excludes SPIN_OFF, ALTERNATIVE, SUMMARY,
// CHARACTER and OTHER — those link genuinely different shows (Attack on Titan:
// Junior High, the recap movies) that shouldn't share a title.
export const SEASON_RELATIONS = new Set(['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY']);

// Formats that read as "the show itself" rather than an extra, used to keep an
// OVA from naming the franchise when a TV season is also in the list.
const TV_FORMATS = new Set(['TV', 'TV_SHORT']);

// A trailing "this is the Nth run of the same show" marker, with whatever
// separator precedes it. Covers the forms AniList's English titles actually
// use: "Season 2", "2nd Season", "Part 2", "Cour 2", "The Final Season", "S2",
// and roman numerals ("Mob Psycho 100 II").
//
// Deliberately NOT here: a bare trailing number. "Mob Psycho 100" and "JUJUTSU
// KAISEN 0" would lose part of their real names, and a numbered sequel is
// nearly always spelled with one of the words above anyway.
const SEASON_MARKER = new RegExp(
  '[\\s:\\-\u2013\u2014]*(?:'
  + 'the\\s+final\\s+season|final\\s+season'
  + '|(?:season|part|cour)\\s*\\d+'
  + '|\\d+(?:st|nd|rd|th)\\s+season'
  + '|s\\d+'
  + '|(?:ii|iii|iv|vi{0,3}|v)'
  + ')\\s*$',
  'i'
);

/**
 * Title-only identity for a show, for merging season entries in a profile that
 * predates franchise grouping (or was hand-entered). "Attack on Titan Season 2"
 * and "Attack on Titan: The Final Season" both key to "attack on titan".
 *
 * Strips repeatedly, so "SPY x FAMILY Season 1 Part 2" reduces all the way.
 * Never returns empty — a title that is nothing BUT a marker keys to itself.
 *
 * This is a heuristic and stays deliberately conservative: it only merges shows
 * whose titles differ by a season marker, so "Attack on Titan: Junior High"
 * (a spin-off) and "Demon Slayer: Entertainment District Arc" (an arc name, not
 * a season) stay separate. groupIntoFranchises is what catches those, when
 * AniList relation data is available.
 */
export function franchiseTitleKey(title) {
  const base = normalizeTitle(title);
  let key = base;
  for (;;) {
    const stripped = key.replace(SEASON_MARKER, '').trim();
    if (stripped === key || stripped === '') break;
    key = stripped;
  }
  return key || base;
}

function makeUnionFind() {
  const parent = new Map();

  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    // Flatten the path so repeated lookups stay cheap.
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor);
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };

  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  return { find, union };
}

// Sortable number for an AniList FuzzyDate. Missing parts sort last so a show
// with no air date never wins the "earliest" tie-break by accident.
function airDateKey(startDate) {
  const year = startDate?.year ?? 9999;
  const month = startDate?.month ?? 99;
  const day = startDate?.day ?? 99;
  return year * 10000 + month * 100 + day;
}

// Which of two entries should give the franchise its name: a TV season over an
// OVA/movie/special, then whichever aired first, then the lower AniList id
// (older entries have lower ids, so this is a stable last resort).
function isBetterCanonical(candidate, current) {
  const candidateIsTv = TV_FORMATS.has(candidate.format);
  const currentIsTv = TV_FORMATS.has(current.format);
  if (candidateIsTv !== currentIsTv) return candidateIsTv;

  const candidateDate = airDateKey(candidate.startDate);
  const currentDate = airDateKey(current.startDate);
  if (candidateDate !== currentDate) return candidateDate < currentDate;

  return candidate.id < current.id;
}

/**
 * Collapses a user's list entries into one group per show.
 *
 * Returns [{ key, title, coverImageUrl, memberIds, members }], where `key` and
 * `title` come from the canonical member and `memberIds` are every AniList id
 * to fetch characters for. Groups keep the order their canonical member had in
 * the incoming list, so the import checklist doesn't reshuffle.
 */
export function groupIntoFranchises(entries) {
  const list = entries ?? [];
  const { find, union } = makeUnionFind();

  // Union over relation endpoints, not just list members: a related id the user
  // doesn't own still bridges the seasons on either side of it (AoT S3 and S4
  // only meet through "S3 Part 2"; Demon Slayer S1 and Entertainment District
  // only meet through the Mugen Train TV arc).
  for (const entry of list) {
    find(entry.id);
    for (const relatedId of entry.relatedIds ?? []) union(entry.id, relatedId);
  }

  const membersByRoot = new Map();
  const indexById = new Map();
  list.forEach((entry, index) => {
    indexById.set(entry.id, index);
    const root = find(entry.id);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root).push(entry);
  });

  const groups = [];
  for (const members of membersByRoot.values()) {
    const canonical = members.reduce((best, m) => (isBetterCanonical(m, best) ? m : best));
    groups.push({
      key: canonical.id,
      title: canonical.title,
      coverImageUrl: canonical.coverImageUrl,
      memberIds: members.map((m) => m.id),
      members,
    });
  }

  groups.sort((a, b) => indexById.get(a.key) - indexById.get(b.key));
  return groups;
}
