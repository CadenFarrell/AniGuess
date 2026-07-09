import { normalizeTitle } from './ranking';

// Merges freshly-imported anime/characters into an existing profile, deduping
// by title (anime) and lowercased name (character within a matched anime) —
// the same rule seedProfiles.js's console-paste merge logic already used.
// `importedAnimeList` entries: { animeId, title, characters }.
export function mergeAnimeIntoProfile(profile, importedAnimeList) {
  const animeList = profile.animeList.map((a) => ({ ...a, characters: [...a.characters] }));
  let addedAnime = 0;
  let addedChars = 0;

  for (const imported of importedAnimeList) {
    const existing = animeList.find(
      (a) => normalizeTitle(a.title) === normalizeTitle(imported.title)
    );

    if (!existing) {
      animeList.push({
        id: `anilist_anime_${imported.animeId}`,
        title: imported.title,
        characters: imported.characters,
      });
      addedAnime++;
      addedChars += imported.characters.length;
    } else {
      for (const char of imported.characters) {
        const alreadyHas = existing.characters.some(
          (c) => c.name.toLowerCase() === char.name.toLowerCase()
        );
        if (!alreadyHas) {
          existing.characters.push(char);
          addedChars++;
        }
      }
    }
  }

  return { profile: { ...profile, animeList }, addedAnime, addedChars };
}
