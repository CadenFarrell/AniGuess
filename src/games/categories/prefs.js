// Every option AniTag remembers between sessions, at its literal default. One
// module rather than a literal in each screen — AniTagSetup and OnlineLobby
// offer overlapping sets and both import this — and it doubles as the schema
// useGamePrefs validates a saved blob against (see shared/utils/gamePrefs.js).
//
// THIS GAME NEEDS NO ANILIST IMPORT, AND NOTHING HERE MAY QUIETLY CHANGE THAT.
// A proposal is free text judged by a person, so no pool is ever drawn from
// anybody's list — which makes AniTag the second game in the arcade (after
// AniWave's default clue mode) that a brand-new player can open and play. There
// is deliberately no `sharedOnly`, no card pool and no minimum list size in this
// file, and adding one would be adding the requirement itself. AniWave's prefs.js
// carries the same warning about `clueMode`; decide it out loud rather than
// discover it.
//
// `categoryPool` is NOT that requirement sneaking back in. It picks which
// built-in clauses get dealt — ones about shows, or ones about characters — and
// both lists ship in categories.js. It reaches nobody's profile.
export const DEFAULT_PREFS = {
  rounds: 3,
  // 'chosen' | 'dealt'. Copied onto the round node, because rules.js ACTS on it
  // — requiredJudges branches on nothing else — which is CLAUDE.md's stated
  // test for which prefs reach round state.
  //
  // DEFAULTING TO 'chosen' MOVES EXISTING PLAYERS, and that is the intent
  // rather than a side effect. mergePrefs fills a missing key from this literal
  // on the next read, so everyone who never opens the settings card lands in
  // the new mode; the dealt game is still one tap away and nothing they saved
  // is lost. rules.js's own fallback is the opposite ('dealt'), which is not a
  // contradiction — see toMode there: the only round reaching it without a mode
  // is one already in flight from the previous build.
  categoryMode: 'chosen',
  // Names per player, per ROUND — spent one at a time, because the seat moves
  // after every single name. Copied onto the round node, unlike everything else
  // here, because rules.js ACTS on it (see settlePending and proposalsUsed),
  // which is CLAUDE.md's stated test for which prefs reach round state. A
  // mid-session change would otherwise re-cap a round already half-spent.
  //
  // It is not simply "how long your turn is" any more: a missed declaration is
  // charged against it at WRONG_DECLARATION_COST, so the cap is also the price
  // list for guessing early.
  proposalCap: 10,
  // 'shows' | 'characters'. One pool per session, in BOTH modes, though for two
  // different reasons. In dealt mode the hot seat cannot see their clause, so
  // the prompt telling them what to name is the only thing that says which pool
  // it is about and a per-player pool would turn that prompt into a clue. In
  // chosen mode everybody knows their own, but they are all answering the SAME
  // name — so one player holding a clause about shows while the table names
  // characters can only ever answer no. See the note on CATEGORIES.
  categoryPool: 'characters',
  // Whether the player's own written categories are in play. In dealt mode they
  // join the built-ins in the deal; in chosen mode they head the list of
  // suggestions you pick your own from. On by default: somebody who has written
  // one wrote it to play it, and a table with none is unaffected either way.
  useCustom: true,
};

// The modes a session can play, in the order the screens render them — so the
// default is the one a player reads first. Exported so a screen cannot invent a
// third that rules.js has never heard of.
export const CATEGORY_MODES = ['chosen', 'dealt'];

// What each mode is called on screen, and the one line that says how it differs.
// `blurb` is deliberately about WHERE THE CLAUSE IS rather than about scoring,
// because that is the only thing a player has to understand before starting.
export const MODE_LABELS = {
  chosen: {
    label: 'Pick your own',
    blurb: 'You choose a category only you can see. Everyone answers every name against theirs, and you work out somebody else\u2019s.',
  },
  dealt: {
    label: 'Dealt blind',
    blurb: 'You are handed a category you cannot see. One judge answers, and you work out your own.',
  },
};

// Bounds for the round-count field. A session of one is a legitimate warm-up;
// the upper bound only exists to stop a typo producing a game the leaderboard
// cannot show.
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 20;

// The pools a session can draw from, in the order the setup screen renders
// them. Exported so a screen cannot invent a third that categories.js has never
// heard of.
export const CATEGORY_POOLS = ['characters', 'shows'];

// What each pool is called on screen, and what a turn in it asks you to name.
// `noun` is singular because it lands in "Name a character" — the prompt the
// hot seat spends the whole turn looking at.
export const POOL_LABELS = {
  characters: { label: 'Characters', noun: 'character', plural: 'characters' },
  shows: { label: 'Shows', noun: 'show', plural: 'shows' },
};
