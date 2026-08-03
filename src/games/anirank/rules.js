// All AniRank logic: no React, no storage, no network. Each function
// takes a slice of round state and returns a { patch } for the caller to apply
// however its persistence layer works — useState locally, a Firebase
// transaction online. See CLAUDE.md: change game behaviour here, not in the
// hooks, or local and online drift apart.
//
// The game: ten cards arrive one at a time. Every player commits each one to a
// slot before the next is revealed, and a placed card never moves. Everyone is
// on the same card at the same time — that shared cursor is what keeps it blind,
// since a player who could run ahead would be ranking a list they had already
// seen in full.
//
// What the slots MEAN is not decided here. A card carries a `value` the deck
// builder stamped on it from the round's axis (see axes.js), and the two modes
// differ only in where the answer key comes from:
//
//   fact     rankMap(trueOrder(deck))  — sort the cards by their value
//   opinion  rankMap(subject board)    — one player's own board is the key
//
// Both collapse to the same { itemId: rank } map, so scoreBoard never branches.

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

// `subjectId` is the player an opinion round is about — everyone, including
// them, ranks the cards as they would. Null for a fact round, and stored on the
// round rather than derived so a mid-round roster change cannot silently move
// the answer key out from under boards already committed against it.
export function startRound(players, deck, subjectId = null) {
  return {
    deck,
    cursor: 0,
    subjectId,
    boards: Object.fromEntries(players.map((p) => [p.id, new Array(deck.length).fill(null)])),
  };
}

// Whose turn it is to be the subject. Indexed by round so it walks the roster
// instead of re-picking at random and leaving someone out all night.
export function subjectFor(playerIds, roundIndex = 0) {
  if (!playerIds?.length) return null;
  return playerIds[roundIndex % playerIds.length];
}

// The card every player is currently placing.
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

// The order the cards should have been in, for a FACT round. Sorted by the
// `value` the deck builder stamped from the axis, with the title as a stable
// tie-break so every device computes the identical answer.
export function trueOrder(deck) {
  return [...deck].sort((a, b) => a.value - b.value || a.title.localeCompare(b.title));
}

/**
 * Collapses any answer key into { itemId: rank }, which is the only thing
 * scoreBoard needs and the reason it never has to know which mode it is in.
 *
 * Cards sharing a `value` share a rank, so a fact round where two shows aired
 * the same year accepts either order — the tie-forgiveness that used to live in
 * the `a.year <= b.year` comparison, now expressed once. A subject's board has
 * no values (every slot is a deliberate choice), so each position is its own
 * rank and there are no ties to forgive.
 */
export function rankMap(ordered) {
  const list = ordered ?? [];
  const out = {};
  let rank = 0;
  let previous;
  // A plain index loop, not forEach: forEach skips holes, and a board that came
  // back from RTDB half-filled is exactly the sparse shape normalizeBoard exists
  // to repair. Callers pass dense arrays today; this stays correct if one doesn't.
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const tied = previous != null && item.value != null && item.value === previous;
    if (!tied) rank = i;
    out[item.id] = rank;
    previous = item.value ?? null;
  }
  return out;
}

// The answer key for a round, whichever mode it is in. Returns null when an
// opinion round has no usable subject board — the caller renders an unscored
// reveal rather than inventing a winner.
export function truthFor(state, { opinion = false } = {}) {
  if (!opinion) return trueOrder(state.deck ?? []);
  const board = normalizeBoard(state.boards?.[state.subjectId], state.deck?.length ?? BOARD_SIZE);
  return board.every(Boolean) ? board : null;
}

// Scores one finished board against an answer key.
//
// `ordered` — adjacent pairs left in the right relative order, out of nine. The
// headline score, and deliberately forgiving: one card in the wrong place costs
// a point or two rather than shifting everything after it.
//
// `exact` — slots holding the card that truly belongs there. Reported for
// interest, not scored, because with ties it is not always achievable.
export function scoreBoard(board, deck, truth) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);
  const key = truth ?? trueOrder(deck ?? []);
  const ranks = rankMap(key);

  let ordered = 0;
  for (let i = 0; i < size - 1; i++) {
    const a = filled[i];
    const b = filled[i + 1];
    if (!a || !b) continue;
    const ra = ranks[a.id];
    const rb = ranks[b.id];
    if (ra != null && rb != null && ra <= rb) ordered++;
  }

  let exact = 0;
  for (let i = 0; i < size; i++) {
    if (filled[i] && key[i] && filled[i].id === key[i].id) exact++;
  }

  const perfect = ordered === size - 1;
  return { ordered, exact, perfect, score: ordered };
}

/**
 * Every player's score for the round, keyed by id — the shape totalScores and
 * shared/utils/ranking.js's computeRankedPlayers both expect.
 *
 * In an opinion round the subject cannot be scored against their own board, so
 * they take the mean of everyone who guessed at them. Scoring them zero would
 * punish a player for being picked, and leaving them out puts a hole in the
 * leaderboard; the mean reads as "how predictable were you", which is the thing
 * the round is actually measuring about them.
 *
 * Returns {} when there is no answer key (an unscored round, or a subject who
 * never finished their board) — callers gate applyRoundScores on that.
 */
export function finalScores(state, playerIds, { opinion = false, scoring = true } = {}) {
  if (!scoring) return {};
  const truth = truthFor(state, { opinion });
  if (!truth) return {};

  const out = {};
  for (const id of playerIds) {
    if (opinion && id === state.subjectId) continue;
    out[id] = scoreBoard(state.boards?.[id], state.deck, truth).score;
  }

  if (opinion && state.subjectId && playerIds.includes(state.subjectId)) {
    const guesses = Object.values(out);
    out[state.subjectId] = guesses.length
      ? Math.round(guesses.reduce((a, b) => a + b, 0) / guesses.length)
      : 0;
  }
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
