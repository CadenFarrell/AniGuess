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

// Merges freshly-imported anime/characters into an existing profile. Imported
// entries are franchise groups: { animeId (canonical AniList id), memberIds,
// title, characters }.
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
    const memberIds = imported.memberIds ?? [imported.animeId];
    const memberEntryIds = new Set(memberIds.map((id) => `anilist_anime_${id}`));
    const canonicalId = `anilist_anime_${imported.animeId}`;

    const importedKey = franchiseTitleKey(imported.title);
    const matches = animeList.filter(
      (a) => memberEntryIds.has(a.id)
        || franchiseTitleKey(a.title) === importedKey
        || isSameShowByCast(a.characters, imported.characters)
    );

    if (matches.length === 0) {
      animeList.push({
        id: canonicalId,
        title: imported.title,
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
    base.id = canonicalId;
    if (isBetterTitle(imported, base)) base.title = imported.title;
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
