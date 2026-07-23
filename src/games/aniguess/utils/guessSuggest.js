// Ranking for the guess-box autocomplete, shared by the local GameScreen and
// the online OnlineGameScreen so both order results identically. Pure, like
// its sibling guessMatch.js — this only decides what the dropdown SHOWS.
// Whether a submitted guess is correct is guessMatch.isCorrectGuess's job and
// is deliberately unaffected by anything here.

// Romanized titles and names are full of ō / ū / ā, and nobody types those —
// fold them so "Jujutsu" finds "Jūjutsu".
function normalize(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const startsWithWord = (text, q) =>
  text.split(/[\s,.:;!?'"()\-_/]+/).some((w) => w.startsWith(q));

// Lower is better. Every name tier beats every series tier, so searching by
// series never pushes an obvious name match off the list.
function score(name, series, q) {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (startsWithWord(name, q)) return 2;
  if (name.includes(q)) return 3;
  if (series.startsWith(q) || startsWithWord(series, q)) return 4;
  if (series.includes(q)) return 5;
  return null;
}

// chars: [{ name, series, imageUrl }] — the shape both guess screens already
// build. Returns the best `limit` matches, deduped, in a stable order so the
// list doesn't reshuffle under the user's cursor as they keep typing.
export function rankSuggestions(chars, query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];

  const seen = new Set();
  const scored = [];
  for (const c of chars) {
    const key = `${c.series}::${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rank = score(normalize(c.name), normalize(c.series), q);
    if (rank !== null) scored.push({ c, rank });
  }

  scored.sort((a, b) =>
    a.rank - b.rank ||
    a.c.name.length - b.c.name.length ||
    a.c.name.localeCompare(b.c.name)
  );
  return scored.slice(0, limit).map((s) => s.c);
}
