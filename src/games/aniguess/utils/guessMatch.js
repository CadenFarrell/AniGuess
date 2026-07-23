// Pure guess-matching logic, extracted out of GameScreen.jsx so it can also
// be used by online mode's non-guesser-device resolution path (the guesser's
// own device must never hold the character data needed to run this itself).
export function isCorrectGuess(character, raw) {
  const g = raw.trim().toLowerCase();
  if (!g) return false;
  const name = character.name.toLowerCase();
  if (g === name) return true;
  if (g.length >= 3 && name.includes(g)) return true;
  return character.nicknames?.some((n) => {
    const nn = n.toLowerCase();
    return g === nn || (g.length >= 3 && nn.includes(g));
  }) ?? false;
}
