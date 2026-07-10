import { normalizeTitle } from './ranking';

// Pure helpers for building the pool of characters that can be assigned to a
// player. Shared by the local pass-and-play CharacterAssignment and the online
// OnlineCharacterAssignment so both filter/randomize identically.

// The assignee's own shows, optionally narrowed to those at least one OTHER
// player also has (so the character is guessable by the table), with empty
// shows removed.
export function getAssignableAnimeList(guesser, allPlayers, sharedShowsOnly = true) {
  return (sharedShowsOnly && allPlayers?.length
    ? guesser.animeList.filter((anime) =>
        allPlayers.some((p) => p.id !== guesser.id && p.animeList.some((a) => normalizeTitle(a.title) === normalizeTitle(anime.title))))
    : guesser.animeList
  ).filter((a) => a.characters.length > 0);
}

// Picks a random character from the given anime list, tagging it with its
// series. twoStepRandom picks a show first (every show equally likely) then a
// character within it; otherwise every character across all shows is equally
// likely. Returns null if there's nothing to pick from.
export function pickRandomCharacter(animeList, twoStepRandom = false) {
  if (!animeList || animeList.length === 0) return null;
  let pool;
  if (twoStepRandom) {
    const anime = animeList[Math.floor(Math.random() * animeList.length)];
    pool = anime.characters.map((c) => ({ ...c, series: anime.title }));
  } else {
    pool = animeList.flatMap((a) => a.characters.map((c) => ({ ...c, series: a.title })));
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
