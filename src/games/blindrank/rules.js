// All Blind Ranking logic: no React, no storage, no network. Each function
// takes a slice of round state and returns a { patch } for the caller to apply
// however its persistence layer works — useState locally, a Firebase
// transaction online. See CLAUDE.md: change game behaviour here, not in the
// hooks, or local and online drift apart.
//
// The game: ten shows arrive one at a time. Every player commits each one to a
// slot before the next is revealed, and a placed show never moves. Slot 1 is
// the oldest, slot 10 the newest. Everyone is on the same show at the same
// time — that shared cursor is what keeps it blind, since a player who could
// run ahead would be ranking a list they had already seen in full.

export const BOARD_SIZE = 10;

// Realtime Database has no concept of a null array element: a board with one
// show placed in slot 5 comes back either as a 6-long array with holes or — once
// it is mostly empty — as an object keyed by index ({ "5": {...} }). Both shapes
// have to become a dense, fixed-length array before anything below indexes into
// them. Local play never sees either shape, which is exactly why this needs a
// test rather than a round of online debugging.
export function normalizeBoard(raw, size = BOARD_SIZE) {
  const out = new Array(size).fill(null);
  if (!raw) return out;
  if (Array.isArray(raw)) {
    // A plain index loop, NOT map/forEach: those skip holes, and a sparse array
    // is precisely what RTDB hands back for a half-filled board.
    for (let i = 0; i < raw.length && i < size; i++) {
      if (raw[i] != null) out[i] = raw[i];
    }
    return out;
  }
  for (const [k, v] of Object.entries(raw)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < size && v != null) out[i] = v;
  }
  return out;
}

// Every board in `raw`, plus an empty one for any listed player who has none
// yet. Deliberately keeps boards belonging to ids NOT in playerIds: callers
// pass the *active* roster to the readiness gates, and rebuilding this object
// from that list would delete a departed player's answers the next time anyone
// wrote to the round. Their board still has to be there at the reveal.
export function normalizeBoards(raw, playerIds = [], size = BOARD_SIZE) {
  const out = {};
  for (const id of Object.keys(raw ?? {})) out[id] = normalizeBoard(raw[id], size);
  for (const id of playerIds) {
    if (!out[id]) out[id] = normalizeBoard(null, size);
  }
  return out;
}

// How many shows this player has committed — and therefore which deck index
// they are on. Derived rather than stored so it can never disagree with the
// board it describes.
export function placedCount(board) {
  return normalizeBoard(board).filter(Boolean).length;
}

export function startRound(players, deck) {
  return {
    deck,
    cursor: 0,
    boards: Object.fromEntries(players.map((p) => [p.id, new Array(deck.length).fill(null)])),
  };
}

// The show every player is currently placing.
export function currentItem(state) {
  return state.deck?.[state.cursor] ?? null;
}

// Who the round is still waiting on for the current show. Local play takes the
// first of these as "whose turn to pass the device to"; online play renders the
// whole list as "waiting on…".
export function pendingPlacers(state, playerIds) {
  return playerIds.filter((id) => placedCount(state.boards?.[id]) <= state.cursor);
}

// Commits the current show to a slot. Refuses rather than throws on every way
// this can arrive twice — a double tap, a slow network replaying a write, or a
// player whose device still shows a show the room has moved past.
export function placeItem(state, playerId, slotIndex) {
  const size = state.deck?.length ?? BOARD_SIZE;
  const board = normalizeBoard(state.boards?.[playerId], size);
  const item = currentItem(state);

  if (!item) return { patch: {} };                                  // round is over
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };
  if (board[slotIndex] != null) return { patch: {} };               // slot already taken
  if (placedCount(board) > state.cursor) return { patch: {} };      // already placed this one

  const next = [...board];
  next[slotIndex] = item;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// True once everyone still in the room has committed the current show. Takes
// the *active* ids, never the full roster: a closed tab would otherwise hold
// the reveal open forever.
export function everyonePlaced(state, activeIds) {
  if (!activeIds?.length) return false;
  return pendingPlacers(state, activeIds).length === 0;
}

// Reveals the next show, or ends the round. `finished` is separate from the
// patch because the caller decides what "finished" means for its view.
export function advanceCursor(state) {
  const next = state.cursor + 1;
  const finished = next >= (state.deck?.length ?? 0);
  return { patch: { cursor: next }, finished };
}

// The order the shows should have been in. Sorted by year, with the title as a
// stable tie-break so every device computes the identical answer.
export function trueOrder(deck) {
  return [...deck].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
}

// Scores one finished board.
//
// `ordered` — adjacent pairs left in the right relative order, out of nine. The
// headline score, and deliberately forgiving: one show in the wrong place costs
// a point or two rather than shifting everything after it. Two shows from the
// same year count as ordered either way round, so a tie is never a trap.
//
// `exact` — slots holding the show that truly belongs there. Reported for
// interest, not scored, because with ties it is not always achievable.
export function scoreBoard(board, deck) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);

  let ordered = 0;
  for (let i = 0; i < size - 1; i++) {
    const a = filled[i];
    const b = filled[i + 1];
    if (a && b && a.year <= b.year) ordered++;
  }

  const truth = trueOrder(deck ?? []);
  let exact = 0;
  for (let i = 0; i < size; i++) {
    if (filled[i] && truth[i] && filled[i].id === truth[i].id) exact++;
  }

  const perfect = ordered === size - 1;
  return { ordered, exact, perfect, score: ordered };
}

// Every player's score for the round, keyed by id — the shape totalScores and
// shared/utils/ranking.js's computeRankedPlayers both expect.
export function finalScores(state, playerIds) {
  const out = {};
  for (const id of playerIds) out[id] = scoreBoard(state.boards?.[id], state.deck).score;
  return out;
}

// Folds a round's scores into the running totals. Not idempotent — callers gate
// it, the same way AniGuess's applyRoundScores is gated by a banking claim.
export function applyRoundScores(totalScores, roundScores) {
  const out = { ...totalScores };
  for (const [id, score] of Object.entries(roundScores)) {
    out[id] = (out[id] || 0) + score;
  }
  return out;
}
