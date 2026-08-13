// Every option AniGuess remembers between sessions, at its literal default.
//
// One module rather than a literal in each screen: PlayerSetup and OnlineLobby
// both declared these independently, so the two could drift without anything
// catching it. It doubles as the schema useGamePrefs validates a saved blob
// against — see shared/utils/gamePrefs.js.
//
// The lobby offers only a subset (no timer, no talk mode), which is fine and is
// exactly why savePrefs merges: it saves the three it renders and leaves the
// rest of the slice alone.
export const DEFAULT_PREFS = {
  sharedShowsOnly: true,
  twoStepRandom: false,
  talkMode: false,
  timerEnabled: false,
  timerSeconds: 60,
  pointsPerPosition: [3, 2, 1, 0],
};

// What each slot of `pointsPerPosition` is worth naming on screen, in the same
// order as the array — they index each other, so they live together for the
// same reason DEFAULT_PREFS does: PlayerSetup and OnlineLobby both spelled the
// labels out inline, and a fifth position added to one would have missed the
// other. The last slot is everybody who did not place, not a fourth place.
export const POSITIONS = [
  { icon: '🥇', label: '1st place' },
  { icon: '🥈', label: '2nd place' },
  { icon: '🥉', label: '3rd place' },
  { icon: '👥', label: 'Everyone else' },
];
