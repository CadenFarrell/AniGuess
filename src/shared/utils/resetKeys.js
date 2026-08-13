// Which localStorage keys a crash reset is allowed to clear.
//
// THE LIST IS INVERTED ON PURPOSE — everything goes except a named few — and
// that is the whole point rather than a shortcut. The reset used to remove one
// hardcoded key, 'aniguess_session', which predates the hub: it was written when
// AniGuess was the only game and there was exactly one blob that could wedge it.
// Three games and a settings map arrived afterwards and none were added, so a
// crash caused by a saved room, a tier list or a prefs blob survived the reset
// button and the app came straight back up into the same crash. An allowlist of
// things to keep cannot rot that way; a denylist of things to clear has to be
// remembered every time a game is added, and it was not remembered once in three
// games.
//
// What must survive is the player's imported data. It is expensive to rebuild —
// an AniList import is a rate-limited fetch measured in minutes — and it is
// never the in-progress state that crashed the render. Wiping it would be the
// same data-loss bug ProfilePicker exists to prevent, arrived at from the other
// direction.
//
// PROFILES_KEY is 'aniguess_profiles' rather than something tidier for the
// reason useProfile.js gives: renaming it would orphan every profile already
// saved. It is not AniGuess-specific despite the name.
export const PRESERVED_KEYS = ['aniguess_profiles', 'aniarcade_active_profile'];

/**
 * The keys to remove, given every key currently in storage.
 *
 * Pure and separate from the boundary that calls it so it can be tested without
 * a DOM — the vitest config only runs src/**\/*.test.js under environment:
 * 'node', so logic worth pinning cannot live in the .jsx.
 */
export function keysToClear(allKeys = []) {
  if (!Array.isArray(allKeys)) return [];
  return allKeys.filter((key) => (
    typeof key === 'string' && key !== '' && !PRESERVED_KEYS.includes(key)
  ));
}
