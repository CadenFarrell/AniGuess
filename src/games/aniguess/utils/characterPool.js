import { normalizeTitle } from '../../../shared/utils/ranking';
import { characterNameKey } from '../../../shared/utils/character';

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

// Identity for a picked character: characterNameKey, i.e. the name alone. See
// its comment in shared/utils/character.js for why neither `id` nor
// `series::name` works here.
const characterKey = (c) => characterNameKey(c.name);

// Collapses characters who appear under more than one title into one entry,
// keeping the first (so the reveal still shows a series). Franchise grouping
// handles the season case at import time, but shows it deliberately keeps
// apart — spin-offs, recap movies, genuine crossovers — still repeat a cast,
// and without this those characters get one extra roll of the dice each.
function dedupeByName(pool) {
  const seen = new Set();
  return pool.filter((c) => {
    const key = characterKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Picks a random character from the given anime list, tagging it with its
// series. twoStepRandom picks a show first (every show equally likely) then a
// character within it; otherwise every distinct character across all shows is
// equally likely. `excluding` (a previously picked character) is left out so a
// re-roll never hands back what's already on screen — unless it's the only
// option. Returns null if there's nothing to pick from.
export function pickRandomCharacter(animeList, twoStepRandom = false, excluding = null) {
  if (!animeList || animeList.length === 0) return null;
  let pool;
  if (twoStepRandom) {
    const anime = animeList[Math.floor(Math.random() * animeList.length)];
    pool = dedupeByName(anime.characters.map((c) => ({ ...c, series: anime.title })));
  } else {
    pool = dedupeByName(animeList.flatMap((a) => a.characters.map((c) => ({ ...c, series: a.title }))));
  }
  if (excluding) {
    const remaining = pool.filter((c) => characterKey(c) !== characterKey(excluding));
    if (remaining.length > 0) pool = remaining;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
