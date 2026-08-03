import { normalizeTitle } from './ranking';
import { characterNameKey } from './character';
import { franchiseTitleKey } from './franchise';

// Which of two entries should name the merged show. Shortest title wins, since
// a season entry is its base title plus a marker ("Attack on Titan" beats
// "Attack on Titan: The Final Season").
function isBetterTitle(candidate, current) {
  return normalizeTitle(candidate.title).length < normalizeTitle(current.title).length;
}

// Neither ids nor titles can be trusted to identify a show ACROSS sources:
// generateProfiles.js writes `<player>_anime_<n>` ids and hand-shortened titles
// ("Demon Slayer", "Re:Zero"), while an import writes `anilist_anime_<mediaId>`
// and AniList's own longer titles ("Demon Slayer: Kimetsu no Yaiba"). Character
// names come from AniList on both paths, so the cast is the reliable signal.
//
// Needs a floor AND a ratio: unrelated shows can coincidentally share a common
// given name, and a large cast can share a couple of names by chance. Requiring
// half of the smaller cast rules both out.
const SHARED_CAST_MIN = 2;
const SHARED_CAST_RATIO = 0.5;

function isSameShowByCast(charsA = [], charsB = []) {
  const smaller = Math.min(charsA.length, charsB.length);
  if (smaller === 0) return false;
  const names = new Set(charsB.map((c) => characterNameKey(c.name)));
  const shared = charsA.filter((c) => names.has(characterNameKey(c.name))).length;
  return shared >= SHARED_CAST_MIN && shared >= smaller * SHARED_CAST_RATIO;
}

// Adds a character to an anime entry unless a character with the same name is
// already there. Returns 1 if it was added, 0 otherwise.
function addCharacterIfNew(entry, char) {
  const key = characterNameKey(char.name);
  const alreadyHas = entry.characters.some((c) => characterNameKey(c.name) === key);
  if (alreadyHas) return 0;
  entry.characters.push(char);
  return 1;
}

// Normalizes the two shapes that describe the same thing. A franchise group from
// groupIntoFranchises carries `key`; an imported entry built by AniListImport
// carries `animeId`. Same integer, different name, so callers don't reshape.
function groupIdentity(group) {
  const animeId = group.animeId ?? group.key;
  const memberIds = group.memberIds ?? [animeId];
  return {
    animeId,
    memberIds,
    canonicalId: `anilist_anime_${animeId}`,
    memberEntryIds: new Set(memberIds.map((id) => `anilist_anime_${id}`)),
    titleKey: franchiseTitleKey(group.title),
  };
}

// Everything about "is this profile entry part of this group" that is knowable
// WITHOUT the characters: an exact id hit on any member, or the title keying to
// the same show. mergeAnimeIntoProfile ORs isSameShowByCast on top of this; the
// import checklist can only ever use this half, because deciding the cast test
// needs the very fetch it is trying to avoid. One definition, so the checklist
// can never disagree with what the merge will actually do.
function matchesGroupIdentity(entry, identity) {
  return identity.memberEntryIds.has(entry.id)
    || franchiseTitleKey(entry.title) === identity.titleKey;
}

// The per-show facts a saved entry carries beyond its cast. Only ever written
// from an import, and only these keys — a profile entry is otherwise
// { id, title, characters }, and every consumer has to keep tolerating an entry
// that predates this list (they are absent, not null, on an old profile).
//
// They exist because a ranking game needs a number per show and the alternative
// is a network call per round, which would break the "local play touches no
// network" property CLAUDE.md asks callers to preserve.
const STAT_KEYS = ['coverImageUrl', 'startDate', 'episodes', 'averageScore', 'popularity'];

function pickStats(imported) {
  const out = {};
  for (const key of STAT_KEYS) {
    if (imported[key] != null) out[key] = imported[key];
  }
  return out;
}

// Fills in stats the entry doesn't have yet, and deliberately does NOT overwrite
// ones it does. A re-import is the repair path for profiles saved before these
// fields existed, but it must not clobber a value already stored — the imported
// group is dated by its earliest season, which is not necessarily what an entry
// merged from another source should be re-dated to.
function backfillStats(entry, imported) {
  for (const [key, value] of Object.entries(pickStats(imported))) {
    if (entry[key] == null) entry[key] = value;
  }
}

// Merges freshly-imported anime/characters into an existing profile. Imported
// entries are franchise groups: { animeId (canonical AniList id), memberIds,
// title, characters } plus the STAT_KEYS above.
//
// Because a franchise's seasons may already be saved as separate entries from an
// older import, an existing entry is considered part of the group if it carries
// an `anilist_anime_<memberId>` id for any of the group's members, OR if its
// title keys to the same show (franchiseTitleKey, so "Attack on Titan Season 2"
// matches an "Attack on Titan" import even when the ids don't line up — which is
// the case for hand-entered entries and profiles from generateProfiles.js). All
// such entries are folded into one canonical entry, keeping their characters,
// before the imported characters are merged in.
export function mergeAnimeIntoProfile(profile, importedAnimeList) {
  let animeList = profile.animeList.map((a) => ({ ...a, characters: [...a.characters] }));
  let addedAnime = 0;
  let addedChars = 0;

  for (const imported of importedAnimeList) {
    const identity = groupIdentity(imported);
    const matches = animeList.filter(
      (a) => matchesGroupIdentity(a, identity)
        || isSameShowByCast(a.characters, imported.characters)
    );

    if (matches.length === 0) {
      animeList.push({
        id: identity.canonicalId,
        title: imported.title,
        ...pickStats(imported),
        characters: imported.characters,
      });
      addedAnime++;
      addedChars += imported.characters.length;
      continue;
    }

    // Fold every matched entry into the first one and drop the rest. The id
    // always becomes the canonical AniList one, so a profile that was seeded
    // with non-AniList ids gains them and every later import matches exactly.
    // The title only changes if the imported one is better, so a list that says
    // "Demon Slayer" isn't rewritten to "Demon Slayer: Kimetsu no Yaiba".
    const [base, ...rest] = matches;
    base.id = identity.canonicalId;
    if (isBetterTitle(imported, base)) base.title = imported.title;
    backfillStats(base, imported);
    for (const dupe of rest) {
      for (const char of dupe.characters) addCharacterIfNew(base, char);
    }
    if (rest.length > 0) {
      const dropped = new Set(rest);
      animeList = animeList.filter((a) => !dropped.has(a));
    }

    for (const char of imported.characters) addedChars += addCharacterIfNew(base, char);
  }

  return { profile: { ...profile, animeList }, addedAnime, addedChars };
}

/**
 * Splits the franchise groups on the import checklist into what a re-import
 * would actually buy you, using only what is knowable BEFORE any character
 * fetch: the recorded set of already-fetched AniList ids, plus id/title
 * identity. Selecting only these turns a re-import from "re-fetch all 200
 * shows at ~30 req/min" into "fetch the delta".
 *
 * Three states, because "already in my profile" and "nothing left to fetch"
 * stop being the same question once a franchise gains a season:
 *   'new'     — nothing in the profile looks like this show.
 *   'partial' — some members were fetched before, some weren't: a new season
 *               aired. Worth fetching, so it is suggested.
 *   'known'   — every member already paid for.
 *
 * That distinction is the whole reason `anilistImportedIds` is recorded on the
 * profile rather than inferred: mergeAnimeIntoProfile collapses a franchise's
 * seasons into ONE entry carrying the canonical id, so the surviving entry
 * cannot say which seasons were fetched. Classifying on identity alone would
 * swallow a newly aired season into a 'known' group and never fetch its cast —
 * a regression against today, where selecting everything always picks it up.
 *
 * Returns { byKey, suggested, counts, hasCoverage }. Counts are counts of
 * GROUPS and always sum to groups.length.
 */
export function classifyImportGroups(profile, groups) {
  const animeList = profile?.animeList ?? [];
  // Absent (not empty) means this profile predates the field, which is a
  // different situation from "has imported nothing" — see the fallback below.
  const recorded = profile?.anilistImportedIds;
  const hasCoverage = Array.isArray(recorded);
  const covered = new Set(recorded ?? []);

  const byKey = new Map();
  const suggested = new Set();
  const counts = { new: 0, partial: 0, known: 0 };

  for (const group of groups ?? []) {
    const identity = groupIdentity(group);
    // `.some`, not a consuming match: one profile entry can legitimately be the
    // identity match for several groups (two franchises whose canonical titles
    // key the same), and each is independently known. Nothing is used up.
    const identityMatch = animeList.some((a) => matchesGroupIdentity(a, identity));
    const fetched = hasCoverage
      ? identity.memberIds.filter((id) => covered.has(id)).length
      : 0;

    let state;
    if (hasCoverage && fetched > 0) {
      state = fetched === identity.memberIds.length ? 'known' : 'partial';
    } else {
      // Either no coverage was ever recorded, or it records none of these
      // members. A hand-added or seeded entry can still be this show under a
      // different id and title, so trust identity rather than re-paying for a
      // cast the user already has. On a pre-coverage profile this also keeps
      // the FIRST re-import after this shipped cheap, which is the point; the
      // cost is that a season which aired before it reads as 'known' until the
      // user hits Select All. One import later the coverage set is exact.
      state = identityMatch ? 'known' : 'new';
    }

    byKey.set(group.key, state);
    counts[state]++;
    if (state !== 'known') suggested.add(group.key);
  }

  return { byKey, suggested, counts, hasCoverage };
}

// The ids whose characters we have now paid for, folded into whatever was
// recorded before. Sorted so a profile written twice with the same data is
// identical, which keeps the Firebase profile writes in useRoom /
// useAniTuneRoom from churning and makes the tests trivial to assert.
export function mergeImportedAnilistIds(existing, memberIds) {
  return [...new Set([...(existing ?? []), ...(memberIds ?? [])])].sort((a, b) => a - b);
}

// Repairs an animeList that already carries duplicates: collapses every entry
// of one show — including its separate seasons — into a single entry named
// after the base show, and drops repeated characters within it. Pure,
// idempotent and offline, so it is safe to run on every profile read and fixes
// profiles saved long before franchise grouping existed, with no re-import.
//
// Entries are matched on the title key first (cheap, and the only thing that
// works for a show whose cast was never filled in), then on shared cast — which
// is what catches a seeded "Demon Slayer" sitting next to an imported "Demon
// Slayer: Kimetsu no Yaiba", where neither the id nor the title lines up.
export function dedupeProfileAnimeList(animeList) {
  const shows = [];
  const byTitleKey = new Map();

  for (const anime of animeList ?? []) {
    const key = franchiseTitleKey(anime.title);
    const target = byTitleKey.get(key)
      ?? shows.find((s) => isSameShowByCast(s.characters, anime.characters));

    if (!target) {
      const entry = { ...anime, characters: [] };
      for (const char of anime.characters ?? []) addCharacterIfNew(entry, char);
      shows.push(entry);
      byTitleKey.set(key, entry);
      continue;
    }

    // A later season can come first in the stored list, so the surviving entry
    // takes the best title it has seen rather than whichever it saw first.
    if (isBetterTitle(anime, target)) {
      target.id = anime.id;
      target.title = anime.title;
    }
    for (const char of anime.characters ?? []) addCharacterIfNew(target, char);
    // Point this title at the merged show too, so a third copy hits the fast path.
    byTitleKey.set(key, target);
  }

  return shows;
}
