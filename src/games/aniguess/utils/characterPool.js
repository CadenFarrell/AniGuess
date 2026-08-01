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

// Search filter for the hand-picking browser. Matches on show title OR
// character name, because a player either has a show in mind or a person.
//
// characterNameKey, not ranking.js's normalizeTitle: that one only lowercases,
// so it would miss the ō / ū / ā spellings romanized titles and names are full
// of. guessSuggest.js already folds its query the same way, so typing "jujutsu"
// reaches "Jūjutsu" here exactly as it does in the guess box.
//
// A TITLE match keeps the show's whole cast — someone who typed a show name
// wants to browse it, not a subset. Only a name-only match narrows the cast.
// Deliberately does NOT dedupe a character across shows the way dedupeByName
// does for random picks: there the duplicate is an extra roll of the dice, here
// it is just the same person correctly listed under both shows you own.
export function filterAnimeList(animeList, query) {
  const q = characterNameKey(query);
  if (!q) return animeList;

  return (animeList || []).flatMap((anime) => {
    if (characterNameKey(anime.title).includes(q)) return [anime];
    const characters = anime.characters.filter((c) => characterNameKey(c.name).includes(q));
    return characters.length > 0 ? [{ ...anime, characters }] : [];
  });
}

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
