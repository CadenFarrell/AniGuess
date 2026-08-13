// The pure half of remembered game settings — the shape of the saved blob and
// the rules for reading it back. useGamePrefs.js does the localStorage I/O over
// these; nothing here touches storage or React.
//
// Split out for the reason profileStats.js documents: vite.config.js only runs
// `src/**/*.test.js` under environment 'node', so logic that lands in a hook or
// a .jsx file cannot be covered by the suite as it is configured today. This is
// the half worth pinning — every rule below exists because getting it wrong
// silently corrupts a player's settings rather than throwing.

// One arcade-wide key holding `{ [gameId]: { …option: value } }`, not a key per
// game. A current name, like aniarcade_active_profile — the `<game>_*`
// convention (anirank_custom_prompts, anifake_online_room) is for state one game
// owns, and this is one shared mechanism with a per-game slice.
export const PREFS_KEY = 'aniarcade_game_prefs';

// A stored value replaces its default only if it is still the same shape. typeof
// alone would let an array through where a number belongs (typeof [] is
// 'object'), so arrays are checked explicitly.
function sameShape(value, fallback) {
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (Array.isArray(value)) return false;
  return typeof value === typeof fallback;
}

/**
 * The saved slice for one game, read back against the defaults that describe
 * what the screen actually offers today.
 *
 * `defaults` is the schema, not merely a fallback: keys outside it are dropped,
 * missing keys are filled, and a value of the wrong type loses to its default.
 * That is the whole migration story — same read-time-repair approach as
 * normalizeProfile and normalizeCustomPrompt, with no version flag to maintain:
 *
 * - an option a screen no longer offers stops being restored,
 * - an option added in a later build gets its default on the next read,
 * - a half-written or hand-edited blob cannot put a string into `laps` and take
 *   the round down on the first arithmetic.
 */
export function mergePrefs(stored, defaults) {
  const saved = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = saved[key];
      if (sameShape(value, fallback)) return [key, value];
      // A falling-back array is copied, never handed out by reference: this is
      // the one point where a value out of a module-level DEFAULT_PREFS reaches
      // component state, and an in-place edit there would corrupt the default
      // for every screen until reload.
      return [key, Array.isArray(fallback) ? [...fallback] : fallback];
    })
  );
}

/**
 * The whole blob with `partial` merged into one game's slice.
 *
 * Merged, not replaced, and that is load-bearing rather than tidy. A screen
 * saves only the options it renders, and the pairs are not symmetric: AniGuess's
 * online lobby offers three of the six settings its local setup does. Replacing
 * the slice would mean one online game silently wiping the timer and talk-mode
 * settings the player last chose locally. (Same class of bug as rebuilding a
 * keyed collection from the *active* roster — what is not currently visible is
 * not thereby gone.)
 *
 * `defaults` still gates what may be written, so a caller cannot smuggle in a
 * key no screen reads, and other games' slices are passed through untouched.
 */
export function writePrefs(all, gameId, partial, defaults) {
  const blob = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  const slice = blob[gameId] && typeof blob[gameId] === 'object' ? blob[gameId] : {};

  const accepted = Object.fromEntries(
    Object.entries(partial ?? {}).filter(
      ([key, value]) => key in defaults && sameShape(value, defaults[key])
    )
  );

  return { ...blob, [gameId]: { ...slice, ...accepted } };
}

/**
 * Whether every option is still sitting on its default — what decides if the
 * "reset to defaults" affordance is worth showing.
 *
 * Compares the live values a screen holds, not the saved slice, so the link
 * appears the moment you change something rather than only after a game has been
 * started. Per-key JSON compare because one of these is an array
 * (pointsPerPosition), where === answers the wrong question.
 *
 * Iterates `values`, not `defaults`, because the screens are not all whole: an
 * online lobby renders a subset of what its local twin does. Walking the full
 * defaults would compare an option this screen never had against its default,
 * find `undefined`, and leave the link permanently lit on every lobby.
 */
export function arePrefsDefault(values, defaults) {
  return Object.entries(values ?? {}).every(
    ([key, value]) => JSON.stringify(value) === JSON.stringify(defaults?.[key])
  );
}
