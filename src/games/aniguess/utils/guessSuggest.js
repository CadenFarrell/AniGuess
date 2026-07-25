// Romanized titles and names are full of ō / ū / ā, and nobody types those —
// fold them so "Jujutsu" finds "Jūjutsu". Series titles want the same treatment
// as character names, so this is characterNameKey under a local alias.
import { characterNameKey as normalize } from '../../../shared/utils/character';

// Ranking for the guess-box autocomplete, shared by the local GameScreen and
// the online OnlineGameScreen so both order results identically. Pure, like
// its sibling guessMatch.js — this only decides what the dropdown SHOWS.
// Whether a submitted guess is correct is guessMatch.isCorrectGuess's job and
// is deliberately unaffected by anything here.

const startsWithWord = (text, q) =>
  text.split(/[\s,.:;!?'"()\-_/]+/).some((w) => w.startsWith(q));

// Lower is better. Every name tier beats every series tier, so searching by
// series never pushes an obvious name match off the list. `seriesList` is every
// show the name was listed under, so a character folded down to one row is
// still findable by typing any one of their seasons' titles.
function score(name, seriesList, q) {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (startsWithWord(name, q)) return 2;
  if (name.includes(q)) return 3;
  if (seriesList.some((s) => s.startsWith(q) || startsWithWord(s, q))) return 4;
  if (seriesList.some((s) => s.includes(q))) return 5;
  return null;
}

// chars: [{ name, series, imageUrl }] — the shape both guess screens already
// build. Returns the best `limit` matches, deduped, in a stable order so the
// list doesn't reshuffle under the user's cursor as they keep typing.
export function rankSuggestions(chars, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  // One row per character NAME, not per (series, name) pair. The same person
  // listed under several seasons — or under a spin-off the franchise grouper
  // deliberately leaves separate — must not fill the dropdown with copies of
  // themselves. First entry seen supplies the row's display data; every series
  // they appeared under is collected so search-by-series still reaches them.
  const byName = new Map();
  for (const c of chars) {
    const key = normalize(c.name);
    const existing = byName.get(key);
    if (existing) {
      existing.seriesList.push(normalize(c.series));
      continue;
    }
    byName.set(key, { c, seriesList: [normalize(c.series)] });
  }

  const scored = [];
  for (const { c, seriesList } of byName.values()) {
    const rank = score(normalize(c.name), seriesList, q);
    if (rank !== null) scored.push({ c, rank });
  }

  scored.sort((a, b) =>
    a.rank - b.rank ||
    a.c.name.length - b.c.name.length ||
    a.c.name.localeCompare(b.c.name)
  );
  return scored.slice(0, limit).map((s) => s.c);
}
