// Two character shapes coexist in stored data: AniList-sourced characters
// have `genres` as an array; ListManager-created characters have a singular
// `genre` string. Normalize to always have `genres` as an array so
// consumers never need to branch on which shape they got.
export function normalizeCharacter(char) {
  if (!char) return char;
  const genres = Array.isArray(char.genres) ? char.genres : (char.genre ? [char.genre] : []);
  // eslint-disable-next-line no-unused-vars
  const { genre, ...rest } = char;
  return { ...rest, genres };
}

// Identity for a character ACROSS shows. Not `id`: AniList characters and the
// ones ListManager creates (Date.now()) don't share an id space, so an id can
// collide across sources. Not `series::name` either — the whole point is that
// the same person listed under "Attack on Titan" and "Attack on Titan: Final
// Season" is one character.
//
// Romanized names are full of ō / ū / ā and the same character can arrive
// spelled either way from different seasons, so fold diacritics before
// comparing. Matches how guessMatch.isCorrectGuess already scores a guess:
// by name alone, series ignored.
export function characterNameKey(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
