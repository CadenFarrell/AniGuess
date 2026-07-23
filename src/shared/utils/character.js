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
