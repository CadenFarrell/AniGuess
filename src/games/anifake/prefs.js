import { DEFAULT_FAME_ID } from './fame';
import { DEFAULT_MODE_ID } from './modes';
import { DEFAULT_CLUE_ROUNDS } from './rules';

// Every option AniFake remembers between sessions, at its literal default.
// One module rather than a literal in each screen, and it doubles as the schema
// useGamePrefs validates a saved blob against.
//
// `talkMode` is local-only today — the lobby does not render it, so it simply
// never appears in the partial the lobby saves.
export const DEFAULT_PREFS = {
  mode: DEFAULT_MODE_ID,
  laps: DEFAULT_CLUE_ROUNDS,
  sharedOnly: true,
  talkMode: false,
  // Both default ON, so the fix reaches tables that never open the settings
  // card. mergePrefs fills missing keys from here, which means an existing
  // player's saved blob picks both up on the next read — intended, since
  // changing the current behaviour is the point, but worth knowing that it
  // happens without them asking.
  fame: DEFAULT_FAME_ID,
  allowRedeal: true,
};
