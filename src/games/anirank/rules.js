// All AniRank logic: no React, no storage, no network. Each function
// takes a slice of round state and returns a { patch } for the caller to apply
// however its persistence layer works — useState locally, a Firebase
// transaction online. See CLAUDE.md: change game behaviour here, not in the
// hooks, or local and online drift apart.
//
// The game is dealt one of two ways, chosen per round by `blind` and defaulted
// per axis (see axes.js):
//
//   blind  ten cards arrive one at a time. Every player commits each one to a
//          slot before the next is revealed, and a placed card never moves.
//          Everyone is on the same card at the same time — that shared cursor is
//          what keeps it blind, since a player who could run ahead would be
//          ranking a list they had already seen in full.
//   open   all ten are on the table from the start. Cards move between slots and
//          back to the tray freely until the player locks in, and `cursor` never
//          moves off 0. The round ends when everyone active has locked in.
//
// Only the way boards get FILLED differs. Everything downstream — trueOrder,
// rankMap, truthFor, scoreBoard, finalScores — reads finished boards and never
// asks how the cards got there.
//
// pendingPlacers is the single branch point between the two, deliberately: every
// readiness gate in both hooks funnels through it (everyonePlaced delegates to
// it, local play takes its head as the hot seat, online play renders it as
// "waiting on…"), so branching once there gives open rounds the same
// departed-player escape hatches blind rounds already have.
//
// What the slots MEAN is not decided here. A card carries a `value` the deck
// builder stamped on it from the round's axis (see axes.js), and the two modes
// differ only in where the answer key comes from:
//
//   fact     rankMap(trueOrder(deck))  — sort the cards by their value, biggest
//                                        first, because slot 1 is the top spot
//   opinion  rankMap(subject board)    — one player's own board is the key
//
// Both collapse to the same { itemId: rank } map, so scoreBoard never branches —
// and rank 0 means "belongs at the top" either way, so nothing below this line
// has to know which direction trueOrder sorts in.

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
export function startRound(players, deck, subjectId = null, { blind = true } = {}) {
  return {
    deck,
    cursor: 0,
    subjectId,
    blind,
    // Who has committed their whole board. Only an open round writes to it — a
    // blind round's progress is derived from the cursor instead, so there is
    // nothing to keep in sync.
    locked: {},
    boards: Object.fromEntries(players.map((p) => [p.id, new Array(deck.length).fill(null)])),
  };
}

// Whose turn it is to be the subject. Indexed by round so it walks the roster
// instead of re-picking at random and leaving someone out all night.
export function subjectFor(playerIds, roundIndex = 0) {
  if (!playerIds?.length) return null;
  return playerIds[roundIndex % playerIds.length];
}

// Is this an open round? Stored as `blind`, read as the negative everywhere the
// open path branches. Missing means blind: rounds written before open mode
// existed have no flag, and every one of them was blind.
export function isOpen(state) {
  return state?.blind === false;
}

// The card every player is currently placing. Null in an open round, which has
// no single current card — every caller already null-guards this, because a
// blind round returns null once the cursor runs off the end of the deck.
export function currentItem(state) {
  if (isOpen(state)) return null;
  return state.deck?.[state.cursor] ?? null;
}

// Who the round is still waiting on. Local play takes the first of these as
// "whose turn to pass the device to"; online play renders the whole list as
// "waiting on…".
//
// The one place the two modes diverge — see the header. Blind compares each
// board against the shared cursor; open asks who has not locked in yet.
export function pendingPlacers(state, playerIds) {
  if (isOpen(state)) return playerIds.filter((id) => !state.locked?.[id]);
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

// --- Open rounds -----------------------------------------------------------
//
// The three ways a board changes when all ten cards are on the table at once.
// Each refuses rather than throws for the same reasons placeItem does — a double
// tap, a slow network replaying a write, or a device still showing a round the
// room has moved past — plus one more: a blind round must never reach them, so
// they all check the mode rather than trusting the caller to.

// Puts a specific card in a slot. One rule covers every case the board needs,
// and it is worth stating plainly because it replaces three:
//
//   the card goes in the tapped slot, and whatever was already there takes the
//   card's old place — its previous slot if it had one, otherwise the tray.
//
// So dropping a tray card on an empty slot places, dragging a placed card to an
// empty slot moves, and tapping two filled slots swaps them. Refusing an
// occupied slot (and making the player empty it first) was the clumsier version
// of the same gesture, and made reordering a finished board tedious.
export function placeCard(state, playerId, itemId, slotIndex) {
  if (!isOpen(state)) return { patch: {} };             // blind rounds go through placeItem
  if (state.locked?.[playerId]) return { patch: {} };   // already committed

  const size = state.deck?.length ?? BOARD_SIZE;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };

  const item = (state.deck ?? []).find((c) => c?.id === itemId);
  if (!item) return { patch: {} };                      // not a card in this round

  const board = normalizeBoard(state.boards?.[playerId], size);
  const from = board.findIndex((c) => c?.id === itemId);
  if (from === slotIndex) return { patch: {} };         // already there — nothing moves

  const next = [...board];
  const displaced = next[slotIndex] ?? null;
  next[slotIndex] = item;
  // Only when the card came off the board does anything land back on it; a card
  // picked out of the tray sends the one it displaced back to the tray, which is
  // simply the absence of a slot.
  if (from >= 0) next[from] = displaced;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// Returns a card to the tray.
export function clearSlot(state, playerId, slotIndex) {
  if (!isOpen(state)) return { patch: {} };
  if (state.locked?.[playerId]) return { patch: {} };

  const size = state.deck?.length ?? BOARD_SIZE;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= size) return { patch: {} };

  const board = normalizeBoard(state.boards?.[playerId], size);
  if (board[slotIndex] == null) return { patch: {} };

  const next = [...board];
  next[slotIndex] = null;
  return { patch: { boards: { ...state.boards, [playerId]: next } } };
}

// Commits a finished board. The full-board check is what makes `locked` safe to
// use as the readiness gate: a half-filled board that could lock in would end
// the round early and, if it belonged to an opinion subject, do it with holes in
// the answer key.
export function lockIn(state, playerId) {
  if (!isOpen(state)) return { patch: {} };
  if (state.locked?.[playerId]) return { patch: {} };

  const board = normalizeBoard(state.boards?.[playerId], state.deck?.length ?? BOARD_SIZE);
  if (!board.every(Boolean)) return { patch: {} };
  return { patch: { locked: { ...state.locked, [playerId]: true } } };
}

// The cards this player has not placed yet — the tray. Derived from the board
// rather than stored, so it cannot disagree with what is on the board.
export function unplacedCards(state, playerId) {
  const deck = state.deck ?? [];
  const board = normalizeBoard(state.boards?.[playerId], deck.length || BOARD_SIZE);
  const placed = new Set(board.filter(Boolean).map((c) => c.id));
  return deck.filter((c) => !placed.has(c?.id));
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

// Is the round over? Blind rounds run out of deck; open rounds end when everyone
// still here has locked in. Takes the *active* ids for the same reason
// everyonePlaced does — waiting on a closed tab would hold the reveal forever.
export function roundFinished(state, activeIds = []) {
  if (!state) return false;
  if (isOpen(state)) return everyonePlaced(state, activeIds);
  return state.cursor >= (state.deck?.length ?? 0);
}

// Has nobody committed anything yet? This is the window in which an opinion
// round can still change subject — boards built while guessing at one person
// cannot honestly be rescored against another.
//
// An open round needs its own answer here, and this is the trap: its cursor sits
// at 0 for the whole round, so the blind test would call it untouched right up
// to the reveal and happily swap the answer key out from under ten finished
// boards.
export function roundUntouched(state) {
  if (!state) return false;
  if (!isOpen(state)) return state.cursor === 0;
  if (Object.keys(state.locked ?? {}).length > 0) return false;
  return Object.values(state.boards ?? {}).every((b) => placedCount(b) === 0);
}

// The order the cards should have been in, for a FACT round. Sorted by the
// `value` the deck builder stamped from the axis, with the title as a stable
// tie-break so every device computes the identical answer.
//
// DESCENDING, and that is the board's whole orientation: slot 1 is the TOP of
// the ranking — the most of whatever this axis measures (see ../axes.js, where
// every axis names its ends `topLabel`/`bottomLabel` to match). The tie-break
// stays alphabetical because it only has to be deterministic, not meaningful.
export function trueOrder(deck) {
  return [...deck].sort((a, b) => b.value - a.value || a.title.localeCompare(b.title));
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

// Scores one finished board against an answer key: Kendall tau, every pair of
// cards rather than only the neighbouring ones.
//
// `concordant` — pairs the player got the right way round, out of 45 on a ten
// card board. The score.
//
// This used to count only the nine ADJACENT pairs, and that was the bug behind
// the whole reveal being unreadable. Nine of the forty-five relationships is not
// a measurement of a ranking: a card could sit nine slots from home and cost at
// most two points, because only its two neighbours ever noticed. A board dealt
// by a random number generator scored 6/9 — 67% — for work nobody did. Worse, it
// made the reveal impossible to draw honestly, because "these two are a pair" is
// a fact about where you happened to drop them, not about the ranking.
//
// Counting every pair is proportional instead: being one slot out costs one
// comparison, being nine out costs nine. It stays forgiving where it should —
// dragging one card the length of the board costs 9 of 45, against 2 of 9 under
// the old rule, so a single mistake is no more punished than before — and it
// never cascades, because a displaced card is not re-charged for the cards it
// pushed along.
//
// `ra <= rb`, not `<`, and that single character is the tie forgiveness: cards
// sharing a value share a rank (see rankMap), so a fact round where two shows
// aired the same year accepts either order and is never docked. It is also why
// this function still knows nothing about which direction trueOrder sorts in.
//
// `exact` — slots holding the card that truly belongs there. Reported for
// interest, not scored, because with ties it is not always achievable.
export function scoreBoard(board, deck, truth) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);
  const key = truth ?? trueOrder(deck ?? []);
  const ranks = rankMap(key);

  let concordant = 0;
  let inversions = 0;
  // `comparisons` is counted rather than assumed to be 45: an unfinished board
  // is scored on the pairs it actually has, so the denominator has to be real.
  let comparisons = 0;
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const a = filled[i];
      const b = filled[j];
      if (!a || !b) continue;
      const ra = ranks[a.id];
      const rb = ranks[b.id];
      if (ra == null || rb == null) continue;
      comparisons++;
      if (ra <= rb) concordant++;
      else inversions++;
    }
  }

  let exact = 0;
  for (let i = 0; i < size; i++) {
    if (filled[i] && key[i] && filled[i].id === key[i].id) exact++;
  }

  // Fullness is checked explicitly. The old `ordered === size - 1` test implied
  // it by accident; `inversions === 0` does not, and would call a board with two
  // cards on it perfect.
  const perfect = comparisons > 0 && inversions === 0 && filled.every(Boolean);
  return { concordant, inversions, comparisons, exact, perfect, score: concordant };
}

/**
 * scoreBoard's totals, plus the per-slot detail the reveal draws.
 *
 * This lives here rather than in the results screen for the reason the whole
 * file exists: what a player reads and what they were awarded have to come out
 * of the same comparison.
 *
 *   slots[i]  { item, slot, trueSlot, band, drift, inPlace, conflicts }
 *
 * `conflicts` is the per-card cost: how many other cards this one is the wrong
 * way round against. It is the honest blame, because summed over the board it
 * IS the score — sum(conflicts) === 2 * inversions, every inversion counted once
 * from each end. Anything else would be a proxy. Slot drift in particular is a
 * bad proxy and used to drive the colour: a card three slots from home has zero
 * conflicts if everything it passed was tied with it, and colouring that amber
 * calls a correct board a mistake.
 *
 * There is deliberately no adjacent-pair array here any more. Neighbouring pairs
 * stopped being the scoring unit when scoreBoard moved to Kendall tau, and
 * drawing them would put back the exact misreading this rewrite removed — a mark
 * between two cards that looks like a verdict on them, but is really an accident
 * of where they were dropped.
 *
 * `band` is the span of key positions sharing this card's rank. rankMap gives
 * tied cards one rank on purpose, so measuring drift from a single true position
 * would report an unpenalised tie as misplaced. Anything inside its own band is
 * in place with drift 0; outside, drift is the distance to the nearest end of
 * the band (negative = ranked too high, positive = too low). Drift is text only
 * — "belongs at #7" — and never the colour.
 *
 * `exact` stays scoreBoard's positional count, untouched, so nothing reading it
 * changes; `inPlaceCount` is the band-aware one the screen shows. They differ
 * only where there are ties, which is the case band exists for.
 */
export function explainBoard(board, deck, truth) {
  const size = deck?.length ?? BOARD_SIZE;
  const filled = normalizeBoard(board, size);

  // No key at all: the reveal still draws what they picked, just unjudged.
  //
  // The totals are zeroed here rather than delegated, because scoreBoard falls
  // back to trueOrder(deck) when handed no key — right for a fact round, wrong
  // for the two callers that pass null on purpose (an unscored round, and the
  // opinion subject, who is the key and cannot be measured against it). Passing
  // through would print a score beside a row of blank verdicts.
  if (!truth) {
    return {
      concordant: 0,
      inversions: 0,
      comparisons: 0,
      exact: 0,
      perfect: false,
      score: 0,
      inPlaceCount: 0,
      slots: filled.map((item, i) => ({
        item, slot: i, trueSlot: null, band: null, drift: null, inPlace: false, conflicts: 0,
      })),
    };
  }

  const totals = scoreBoard(board, deck, truth);
  const ranks = rankMap(truth);

  // One band per rank, spanning every key position that shares it. Built from
  // the key rather than per card so a tie group of any size costs one pass.
  const bands = new Map();
  for (let i = 0; i < truth.length; i++) {
    const rank = ranks[truth[i]?.id];
    if (rank == null) continue;
    const band = bands.get(rank);
    if (band) band.hi = Math.max(band.hi, i);
    else bands.set(rank, { lo: i, hi: i });
  }

  // Per-card blame, counted from both ends of every inversion so each card knows
  // its own share. The same `ra <= rb` test scoreBoard uses, so the two can never
  // disagree about what went wrong.
  const conflicts = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const a = filled[i];
      const b = filled[j];
      if (!a || !b) continue;
      const ra = ranks[a.id];
      const rb = ranks[b.id];
      if (ra == null || rb == null || ra <= rb) continue;
      conflicts[i]++;
      conflicts[j]++;
    }
  }

  const positionOf = new Map(truth.map((item, i) => [item.id, i + 1]));
  let inPlaceCount = 0;
  const slots = filled.map((item, i) => {
    if (!item) {
      return {
        item: null, slot: i, trueSlot: null, band: null, drift: null, inPlace: false, conflicts: 0,
      };
    }
    const band = bands.get(ranks[item.id]) ?? null;
    const inPlace = Boolean(band && i >= band.lo && i <= band.hi);
    if (inPlace) inPlaceCount++;
    const drift = !band || inPlace ? 0 : i < band.lo ? i - band.lo : i - band.hi;
    return {
      item,
      slot: i,
      trueSlot: positionOf.get(item.id) ?? null,
      band,
      drift,
      inPlace,
      conflicts: conflicts[i],
    };
  });

  return { ...totals, inPlaceCount, slots };
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
