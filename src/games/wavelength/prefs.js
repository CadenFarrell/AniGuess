// Every option AniWave remembers between sessions, at its literal default. One
// module rather than a literal in each screen — WavelengthSetup and OnlineLobby
// offer overlapping sets and both import this — and it doubles as the schema
// useGamePrefs validates a saved blob against.
//
// THE NO-LIST PROPERTY IS NOW CONDITIONAL, AND `clueMode` IS THE CONDITION.
// AniWave used to draw no cards at all, which made it the one game in the arcade
// playable before an AniList import had ever run — and the setup screen says so,
// because a player arriving from AniGuess assumes otherwise and will go and
// import a list before starting if nothing tells them.
//
// Two of the three clue modes now deal cards, so `sharedOnly` and `cardPool`
// have joined this file. The property survives because `clueMode` DEFAULTS TO
// 'text': mergePrefs fills a missing key from the defaults on the next read, so
// everyone who never opens the settings card still gets exactly the game that
// needed no list. Any future default here that flips that is a breaking change
// to the one thing this game is for — decide it out loud rather than discover it.
//
// `timed` and `guessSeconds` are ONLINE-ONLY, the same way anifake's `talkMode`
// is local-only: WavelengthSetup does not render them, so they simply never
// appear in the partial it saves (writePrefs merges a partial, which is what
// makes that safe). Locally the guess phase is a hot seat — the device is handed
// from one player to the next — so a single shared countdown would be measuring
// the wrong thing entirely.
export const DEFAULT_PREFS = {
  rounds: 8,
  timed: false,
  guessSeconds: 60,
  // See rules.CLUE_MODES. Kept a plain string rather than validated against that
  // list here, because DEFAULT_PREFS is the schema mergePrefs type-checks
  // against and it only knows types — startRound and normalizeRound are where an
  // unrecognised mode falls back.
  clueMode: 'text',
  cardPool: 'characters',
  sharedOnly: true,
};

// Bounds for the round-count field. A session of one is a legitimate warm-up and
// the upper bound only exists to keep a typo from producing a thousand-round
// game that the leaderboard cannot show.
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 30;

export const MIN_GUESS_SECONDS = 15;
export const MAX_GUESS_SECONDS = 180;
