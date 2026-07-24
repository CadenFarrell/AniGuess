// Guess matching for anime titles. Deliberately generous: a player typing
// "jujutsu" for "Jujutsu Kaisen" knows the answer, and the point of the game
// is recognising the song, not spelling romaji.
//
// A question carries two names — the player's own list title (usually
// English) and the AnimeThemes name (romaji) — and either should count.

function normalize(s) {
  return (s || '')
    .toLowerCase()
    // Treat punctuation as a separator so "Re:Zero" and "re zero" agree.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words too common to accept on their own; matching on these alone would let
// "the" or "no" score a point.
const STOPWORDS = new Set(['the', 'a', 'an', 'no', 'of', 'to', 'wa', 'ga', 'na', 'ni', 'and']);

function acceptableNames(question) {
  return [question?.animeTitle, question?.displayTitle].filter(Boolean);
}

export function isCorrectTitleGuess(question, raw) {
  const guess = normalize(raw);
  if (!guess) return false;

  const guessTokens = guess.split(' ').filter((t) => t && !STOPWORDS.has(t));
  if (!guessTokens.length) return false;

  for (const name of acceptableNames(question)) {
    const target = normalize(name);
    if (!target) continue;

    if (guess === target) return true;

    // Whole guess appears in the title ("jujutsu" in "jujutsu kaisen").
    // Require 4+ characters so short fragments cannot brute-force it.
    if (guess.length >= 4 && target.includes(guess)) return true;

    // Or the title appears in a longer guess ("attack on titan season 2").
    if (target.length >= 4 && guess.includes(target)) return true;

    // Every meaningful word of the guess appears in the title, in any order.
    const targetTokens = new Set(target.split(' ').filter(Boolean));
    if (guessTokens.length >= 2 && guessTokens.every((t) => targetTokens.has(t))) return true;
  }

  return false;
}

// Autocomplete over the titles actually in play, so players pick from shows
// they own rather than guessing at romaji spellings. Matches on both names but
// always displays the player's own title.
export function suggestTitles(questions, raw, limit = 6) {
  const guess = normalize(raw);
  if (guess.length < 2) return [];

  const seen = new Set();
  const out = [];
  for (const question of questions) {
    const key = question.animeTitle;
    if (seen.has(key)) continue;
    const haystack = acceptableNames(question).map(normalize);
    if (haystack.some((h) => h.includes(guess))) {
      seen.add(key);
      out.push({ title: question.animeTitle, alt: question.displayTitle });
      if (out.length >= limit) break;
    }
  }
  return out;
}
