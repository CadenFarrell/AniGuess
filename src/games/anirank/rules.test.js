import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE, normalizeBoard, normalizeBoards, placedCount, startRound, currentItem,
  pendingPlacers, placeItem, everyonePlaced, advanceCursor, trueOrder, scoreBoard,
  finalScores, applyRoundScores, rankMap, truthFor, subjectFor,
  isOpen, placeCard, clearSlot, lockIn, unplacedCards, roundFinished, roundUntouched,
} from './rules';

const show = (id, value) => ({ id, title: id, value, imageUrl: '' });
const DECK = [
  show('a', 1998), show('b', 2006), show('c', 2013), show('d', 1995), show('e', 2020),
  show('f', 2001), show('g', 2016), show('h', 1988), show('i', 2009), show('j', 2022),
];
const players = (...ids) => ids.map((id) => ({ id, name: id }));

// A board holding the deck in perfectly sorted order.
const perfectBoard = () => trueOrder(DECK);

describe('normalizeBoard', () => {
  it('turns nothing into a full row of empty slots', () => {
    expect(normalizeBoard(null)).toEqual(new Array(BOARD_SIZE).fill(null));
    expect(normalizeBoard(undefined)).toHaveLength(BOARD_SIZE);
  });

  it('fills the holes Realtime Database leaves in a sparse array', () => {
    const raw = [];
    raw[2] = show('a', 1998);
    const out = normalizeBoard(raw, 4);
    expect(out).toEqual([null, null, show('a', 1998), null]);
  });

  it('accepts the index-keyed object RTDB returns once a board is mostly empty', () => {
    const out = normalizeBoard({ 5: show('a', 1998) }, 10);
    expect(out[5]).toEqual(show('a', 1998));
    expect(out.filter(Boolean)).toHaveLength(1);
    expect(out).toHaveLength(10);
  });

  it('always returns the full length, however short the stored value was', () => {
    expect(normalizeBoard([show('a', 1998)], 10)).toHaveLength(10);
  });

  it('drops indices outside the board rather than growing it', () => {
    const out = normalizeBoard({ 99: show('x', 2000), '-1': show('y', 2000) }, 5);
    expect(out).toEqual(new Array(5).fill(null));
  });

  it('normalizes every player at once, inventing empty boards for those with none', () => {
    const out = normalizeBoards({ a: { 0: show('a', 1998) } }, ['a', 'b'], 3);
    expect(out.a[0]).toEqual(show('a', 1998));
    expect(out.b).toEqual([null, null, null]);
  });

  it('keeps a board whose player is not in the list, so a departure cannot erase it', () => {
    // Callers pass the ACTIVE roster to the readiness gates. Rebuilding this
    // object from that list would delete a departed player's answers on the
    // next write — they still have to be on the board at the reveal.
    const out = normalizeBoards({ a: [show('a', 1998)], gone: [show('b', 2006)] }, ['a'], 3);
    expect(out.gone[0]).toEqual(show('b', 2006));
    expect(Object.keys(out).sort()).toEqual(['a', 'gone']);
  });
});

describe('placedCount', () => {
  it('counts what has been committed, whatever shape it was stored in', () => {
    expect(placedCount(null)).toBe(0);
    expect(placedCount({ 3: show('a', 1998), 7: show('b', 2006) })).toBe(2);
  });
});

describe('startRound', () => {
  it('gives every player an empty board the length of the deck', () => {
    const state = startRound(players('p1', 'p2'), DECK);
    expect(state.cursor).toBe(0);
    expect(state.boards.p1).toHaveLength(10);
    expect(state.boards.p1.every((s) => s === null)).toBe(true);
    expect(Object.keys(state.boards)).toEqual(['p1', 'p2']);
  });
});

describe('currentItem and pendingPlacers', () => {
  it('puts everyone on the same show, which is what keeps the round blind', () => {
    const state = startRound(players('p1', 'p2'), DECK);
    expect(currentItem(state)).toEqual(DECK[0]);
    expect(pendingPlacers(state, ['p1', 'p2'])).toEqual(['p1', 'p2']);
  });

  it('drops a player from the pending list once they commit', () => {
    let state = startRound(players('p1', 'p2'), DECK);
    state = { ...state, ...placeItem(state, 'p1', 0).patch };
    expect(pendingPlacers(state, ['p1', 'p2'])).toEqual(['p2']);
  });

  it('has no current show once the deck runs out', () => {
    const state = { ...startRound(players('p1'), DECK), cursor: 10 };
    expect(currentItem(state)).toBe(null);
  });
});

describe('placeItem', () => {
  it('commits the current show to the chosen slot', () => {
    const state = startRound(players('p1'), DECK);
    const { patch } = placeItem(state, 'p1', 4);
    expect(patch.boards.p1[4]).toEqual(DECK[0]);
    expect(patch.boards.p1.filter(Boolean)).toHaveLength(1);
  });

  it('places the show the cursor points at, not the first one', () => {
    const state = { ...startRound(players('p1'), DECK), cursor: 3 };
    expect(placeItem(state, 'p1', 0).patch.boards.p1[0]).toEqual(DECK[3]);
  });

  it('refuses a slot that is already taken, so a placed show never moves', () => {
    let state = startRound(players('p1'), DECK);
    state = { ...state, ...placeItem(state, 'p1', 4).patch, cursor: 1 };
    expect(placeItem(state, 'p1', 4).patch).toEqual({});
  });

  it('refuses a second placement of the same show, so a double tap costs nothing', () => {
    let state = startRound(players('p1'), DECK);
    state = { ...state, ...placeItem(state, 'p1', 0).patch };
    // cursor has not moved — everyone else is still placing show 0.
    expect(placeItem(state, 'p1', 1).patch).toEqual({});
  });

  it('refuses once the deck is exhausted', () => {
    const state = { ...startRound(players('p1'), DECK), cursor: 10 };
    expect(placeItem(state, 'p1', 0).patch).toEqual({});
  });

  it('refuses a slot index off the board', () => {
    const state = startRound(players('p1'), DECK);
    expect(placeItem(state, 'p1', -1).patch).toEqual({});
    expect(placeItem(state, 'p1', 10).patch).toEqual({});
    expect(placeItem(state, 'p1', 1.5).patch).toEqual({});
  });

  it('leaves the other players\' boards untouched', () => {
    const state = startRound(players('p1', 'p2'), DECK);
    const { patch } = placeItem(state, 'p1', 0);
    expect(patch.boards.p2.every((s) => s === null)).toBe(true);
  });

  it('works from a board RTDB handed back as an index-keyed object', () => {
    const state = { deck: DECK, cursor: 1, boards: { p1: { 7: DECK[0] } } };
    const { patch } = placeItem(state, 'p1', 2);
    expect(patch.boards.p1[2]).toEqual(DECK[1]);
    expect(patch.boards.p1[7]).toEqual(DECK[0]);
    expect(patch.boards.p1).toHaveLength(10);
  });
});

describe('everyonePlaced', () => {
  it('waits for every active player before the next show is revealed', () => {
    let state = startRound(players('p1', 'p2'), DECK);
    expect(everyonePlaced(state, ['p1', 'p2'])).toBe(false);
    state = { ...state, ...placeItem(state, 'p1', 0).patch };
    expect(everyonePlaced(state, ['p1', 'p2'])).toBe(false);
    state = { ...state, ...placeItem(state, 'p2', 0).patch };
    expect(everyonePlaced(state, ['p1', 'p2'])).toBe(true);
  });

  it('ignores a player who has gone, so a closed tab cannot hold the round open', () => {
    let state = startRound(players('p1', 'p2'), DECK);
    state = { ...state, ...placeItem(state, 'p1', 0).patch };
    expect(everyonePlaced(state, ['p1'])).toBe(true);
  });

  it('is false with nobody left rather than declaring an empty room finished', () => {
    expect(everyonePlaced(startRound(players('p1'), DECK), [])).toBe(false);
  });
});

describe('advanceCursor', () => {
  it('reveals the next show', () => {
    const state = startRound(players('p1'), DECK);
    expect(advanceCursor(state)).toEqual({ patch: { cursor: 1 }, finished: false });
  });

  it('reports finished on the last show rather than running off the deck', () => {
    const state = { ...startRound(players('p1'), DECK), cursor: 9 };
    expect(advanceCursor(state)).toEqual({ patch: { cursor: 10 }, finished: true });
  });
});

describe('trueOrder', () => {
  // Descending, because slot 1 is the top of the board — the most of whatever
  // the axis measures. Flipping this comparator flips the whole game.
  it('sorts the biggest value first, so the top slot is the top of the ranking', () => {
    expect(trueOrder(DECK).map((s) => s.value)).toEqual([2022, 2020, 2016, 2013, 2009, 2006, 2001, 1998, 1995, 1988]);
  });

  it('breaks value ties by title so every device computes the same answer', () => {
    const tied = [show('z', 2000), show('a', 2000)];
    expect(trueOrder(tied).map((s) => s.id)).toEqual(['a', 'z']);
    expect(trueOrder([...tied].reverse()).map((s) => s.id)).toEqual(['a', 'z']);
  });

  it('does not mutate the deck', () => {
    const deck = [show('z', 2000), show('a', 1990)];
    trueOrder(deck);
    expect(deck.map((s) => s.id)).toEqual(['z', 'a']);
  });
});

describe('scoreBoard', () => {
  it('gives a perfect board every ordered pair', () => {
    const out = scoreBoard(perfectBoard(), DECK);
    expect(out.ordered).toBe(9);
    expect(out.exact).toBe(10);
    expect(out.perfect).toBe(true);
    expect(out.score).toBe(9);
  });

  it('gives an exactly reversed board nothing', () => {
    const out = scoreBoard([...perfectBoard()].reverse(), DECK);
    expect(out.ordered).toBe(0);
    expect(out.perfect).toBe(false);
  });

  it('costs an adjacent swap only the pair between the two shows', () => {
    const board = perfectBoard();
    [board[4], board[5]] = [board[5], board[4]];
    expect(scoreBoard(board, DECK).ordered).toBe(8);
  });

  it('charges one point per misplaced show rather than cascading down the board', () => {
    // The forgiving property the score exists for: with everything else in
    // order, dropping the oldest show into the middle breaks only the pair it
    // now sits in front of. The eight shows around it keep their points.
    const board = perfectBoard();
    board.splice(4, 0, board.pop());     // 1988 moved from last to slot 4
    expect(scoreBoard(board, DECK).ordered).toBe(8);

    // Same for the newest show sent to the end.
    const other = perfectBoard();
    other.push(other.shift());           // 2022 moved from first to last
    expect(scoreBoard(other, DECK).ordered).toBe(8);

    // Only a thoroughly wrong board loses everything.
    expect(scoreBoard([...perfectBoard()].reverse(), DECK).ordered).toBe(0);
  });

  it('never penalises two cards with the same value, whichever way round they sit', () => {
    const deck = [show('a', 2000), show('b', 2000)];
    expect(scoreBoard([deck[0], deck[1]], deck).ordered).toBe(1);
    expect(scoreBoard([deck[1], deck[0]], deck).ordered).toBe(1);
  });

  it('scores an unfinished board on the pairs it does have', () => {
    const board = new Array(10).fill(null);
    board[0] = show('j', 2022);
    board[1] = show('e', 2020);
    expect(scoreBoard(board, DECK).ordered).toBe(1);
  });

  it('scores an empty board zero rather than throwing', () => {
    expect(scoreBoard(null, DECK)).toMatchObject({ ordered: 0, exact: 0, perfect: false });
  });

  it('reads a board RTDB stored as an index-keyed object', () => {
    const truth = perfectBoard();
    const asObject = Object.fromEntries(truth.map((s, i) => [i, s]));
    expect(scoreBoard(asObject, DECK).ordered).toBe(9);
  });
});

describe('finalScores', () => {
  it('scores every player, including one who never placed anything', () => {
    const state = { deck: DECK, cursor: 10, boards: { p1: perfectBoard() } };
    expect(finalScores(state, ['p1', 'p2'])).toEqual({ p1: 9, p2: 0 });
  });
});

// An opinion round has no objective answer — one player is the subject and
// their own finished board is what everyone else is scored against.
describe('opinion rounds', () => {
  // Ten cards with no values, the shape an opinion axis deals.
  const OPINION_DECK = DECK.map((s) => ({ ...s, value: null }));
  const boardOf = (...ids) => ids.map((id) => OPINION_DECK.find((s) => s.id === id));
  const ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  it('walks the roster so the same player is not the subject every round', () => {
    expect(subjectFor(['p1', 'p2', 'p3'], 0)).toBe('p1');
    expect(subjectFor(['p1', 'p2', 'p3'], 1)).toBe('p2');
    expect(subjectFor(['p1', 'p2', 'p3'], 3)).toBe('p1');
    expect(subjectFor([], 0)).toBe(null);
  });

  it('records the subject on the round rather than deriving it later', () => {
    const state = startRound(players('p1', 'p2'), OPINION_DECK, 'p2');
    expect(state.subjectId).toBe('p2');
  });

  it('gives every slot of a subject board its own rank, since there are no ties', () => {
    const ranks = rankMap(boardOf(...ORDER));
    expect(ranks.a).toBe(0);
    expect(ranks.j).toBe(9);
  });

  it('lets cards sharing a value share a rank, so a fact tie is never a trap', () => {
    const ranks = rankMap([show('x', 2000), show('y', 2000), show('z', 2005)]);
    expect(ranks.x).toBe(0);
    expect(ranks.y).toBe(0);
    expect(ranks.z).toBe(2);
  });

  it('uses the subject board as the answer key', () => {
    const state = {
      deck: OPINION_DECK, cursor: 10, subjectId: 'p2',
      boards: { p1: boardOf(...ORDER), p2: boardOf(...ORDER) },
    };
    expect(truthFor(state, { opinion: true }).map((s) => s.id)).toEqual(ORDER);
  });

  it('scores a guesser who matched the subject perfectly', () => {
    const state = {
      deck: OPINION_DECK, cursor: 10, subjectId: 'p2',
      boards: { p1: boardOf(...ORDER), p2: boardOf(...ORDER) },
    };
    expect(finalScores(state, ['p1', 'p2'], { opinion: true }).p1).toBe(9);
  });

  it('gives the subject the mean of the guesses, not a zero for being picked', () => {
    const reversed = [...ORDER].reverse();
    const state = {
      deck: OPINION_DECK, cursor: 10, subjectId: 'p3',
      boards: {
        p1: boardOf(...ORDER),      // perfect: 9
        p2: boardOf(...reversed),   // inverted: 0
        p3: boardOf(...ORDER),      // the key
      },
    };
    const scores = finalScores(state, ['p1', 'p2', 'p3'], { opinion: true });
    expect(scores.p1).toBe(9);
    expect(scores.p2).toBe(0);
    expect(scores.p3).toBe(5); // round(9 + 0 / 2) — how predictable they were
  });

  // The subject leaving mid-round is this game's second way to lose the answer
  // key; the round still reveals, just without points.
  it('has no answer key when the subject never finished their board', () => {
    const half = [...boardOf(...ORDER.slice(0, 5)), ...new Array(5).fill(null)];
    const state = {
      deck: OPINION_DECK, cursor: 10, subjectId: 'p2',
      boards: { p1: boardOf(...ORDER), p2: half },
    };
    expect(truthFor(state, { opinion: true })).toBe(null);
    expect(finalScores(state, ['p1', 'p2'], { opinion: true })).toEqual({});
  });

  it('scores nothing at all when the round was set to keep no score', () => {
    const state = {
      deck: OPINION_DECK, cursor: 10, subjectId: 'p2',
      boards: { p1: boardOf(...ORDER), p2: boardOf(...ORDER) },
    };
    expect(finalScores(state, ['p1', 'p2'], { opinion: true, scoring: false })).toEqual({});
    // …and a fact round can be unscored too.
    expect(finalScores({ deck: DECK, cursor: 10, boards: {} }, ['p1'], { scoring: false }))
      .toEqual({});
  });
});

describe('applyRoundScores', () => {
  it('adds a round onto the running totals', () => {
    expect(applyRoundScores({ p1: 5 }, { p1: 3, p2: 7 })).toEqual({ p1: 8, p2: 7 });
  });

  it('does not mutate the totals it was given', () => {
    const totals = { p1: 5 };
    applyRoundScores(totals, { p1: 3 });
    expect(totals).toEqual({ p1: 5 });
  });
});

// --- Open rounds ------------------------------------------------------------
//
// The other way a round can be dealt: all ten cards on the table, moved around
// freely, committed in one go. Everything downstream of a finished board —
// trueOrder, scoreBoard, finalScores — is shared with blind rounds and covered
// above, so these cover only the filling.

const openRound = (ids = ['p1', 'p2']) => startRound(players(...ids), DECK, null, { blind: false });

describe('isOpen', () => {
  it('reads a round dealt open', () => {
    expect(isOpen(openRound())).toBe(true);
  });

  // A round stored before open mode existed carries no flag, and every one of
  // those was blind. Defaulting the other way would silently switch the game.
  it('treats a round with no flag at all as blind', () => {
    expect(isOpen({ deck: DECK, cursor: 0 })).toBe(false);
    expect(isOpen(startRound(players('p1'), DECK))).toBe(false);
    expect(isOpen(null)).toBe(false);
  });
});

describe('startRound, dealt open', () => {
  it('marks the round open and starts with nobody locked in', () => {
    const state = openRound();
    expect(state.blind).toBe(false);
    expect(state.locked).toEqual({});
    expect(state.cursor).toBe(0);
  });

  it('still defaults to blind, so every existing caller is unaffected', () => {
    expect(startRound(players('p1'), DECK).blind).toBe(true);
  });
});

describe('currentItem, in an open round', () => {
  // There is no single card being dealt, and every caller already null-guards
  // this because a blind round returns null once the deck runs out.
  it('has no current card', () => {
    expect(currentItem(openRound())).toBe(null);
  });
});

describe('placeCard', () => {
  it('puts a named card in a slot', () => {
    const state = openRound();
    const { patch } = placeCard(state, 'p1', 'c', 3);
    expect(patch.boards.p1[3].id).toBe('c');
    expect(placedCount(patch.boards.p1)).toBe(1);
  });

  // Rearranging is the entire point of an open round. Making the player empty
  // the old slot first would be a clumsier version of the same gesture.
  it('moves a card already on the board rather than duplicating it', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    const moved = placeCard(state, 'p1', 'c', 7).patch.boards.p1;
    expect(moved[3]).toBe(null);
    expect(moved[7].id).toBe('c');
    expect(placedCount(moved)).toBe(1);
  });

  // The rule that replaced "refuse an occupied slot": whatever was there takes
  // the incoming card's old place. These two cover both halves of it.
  it('swaps two placed cards when one is dropped on the other', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    state = { ...state, ...placeCard(state, 'p1', 'd', 7).patch };
    const board = placeCard(state, 'p1', 'c', 7).patch.boards.p1;
    expect(board[7].id).toBe('c');
    expect(board[3].id).toBe('d');
    expect(placedCount(board)).toBe(2);
  });

  it('sends the displaced card to the tray when the incoming one came from there', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    state = { ...state, ...placeCard(state, 'p1', 'd', 3).patch };
    expect(state.boards.p1[3].id).toBe('d');
    expect(placedCount(state.boards.p1)).toBe(1);
    expect(unplacedCards(state, 'p1').map((c) => c.id)).toContain('c');
  });

  it('does nothing when a card is dropped on the slot it already occupies', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    expect(placeCard(state, 'p1', 'c', 3).patch).toEqual({});
  });

  it('refuses a card that is not in this round', () => {
    expect(placeCard(openRound(), 'p1', 'not-a-card', 0).patch).toEqual({});
  });

  it('refuses a slot off either end of the board', () => {
    const state = openRound();
    expect(placeCard(state, 'p1', 'a', -1).patch).toEqual({});
    expect(placeCard(state, 'p1', 'a', BOARD_SIZE).patch).toEqual({});
    expect(placeCard(state, 'p1', 'a', 1.5).patch).toEqual({});
  });

  it('refuses once the player has locked in', () => {
    const state = { ...openRound(), locked: { p1: true } };
    expect(placeCard(state, 'p1', 'a', 0).patch).toEqual({});
  });

  // The two ways of filling a board must not be reachable from one another, or
  // a blind round would quietly gain takebacks.
  it('refuses outright in a blind round', () => {
    expect(placeCard(startRound(players('p1'), DECK), 'p1', 'a', 0).patch).toEqual({});
  });

  it('reads a board RTDB handed back index-keyed', () => {
    const state = { ...openRound(), boards: { p1: { 5: DECK[0] } } };
    const board = placeCard(state, 'p1', 'b', 0).patch.boards.p1;
    expect(board).toHaveLength(BOARD_SIZE);
    expect(board[0].id).toBe('b');
    expect(board[5].id).toBe('a');
  });
});

describe('clearSlot', () => {
  it('sends a card back to the tray', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    const board = clearSlot(state, 'p1', 3).patch.boards.p1;
    expect(board[3]).toBe(null);
    expect(placedCount(board)).toBe(0);
  });

  it('refuses an empty slot, a bad index, and a locked board', () => {
    let state = openRound();
    expect(clearSlot(state, 'p1', 3).patch).toEqual({});
    expect(clearSlot(state, 'p1', 99).patch).toEqual({});
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch, locked: { p1: true } };
    expect(clearSlot(state, 'p1', 3).patch).toEqual({});
  });

  it('refuses outright in a blind round, where a placed card never moves', () => {
    let state = startRound(players('p1'), DECK);
    state = { ...state, ...placeItem(state, 'p1', 0).patch };
    expect(clearSlot(state, 'p1', 0).patch).toEqual({});
  });
});

describe('lockIn', () => {
  const filled = (id = 'p1') => {
    let state = openRound();
    DECK.forEach((card, i) => {
      state = { ...state, ...placeCard(state, id, card.id, i).patch };
    });
    return state;
  };

  it('commits a full board', () => {
    expect(lockIn(filled(), 'p1').patch).toEqual({ locked: { p1: true } });
  });

  // A half-ranked board that could lock in would end the round early — and from
  // an opinion subject, leave holes in the key everyone else is scored against.
  it('refuses a board with an empty slot', () => {
    let state = filled();
    state = { ...state, ...clearSlot(state, 'p1', 4).patch };
    expect(lockIn(state, 'p1').patch).toEqual({});
  });

  it('refuses a second time, so a double tap cannot rewrite the map', () => {
    const state = { ...filled(), locked: { p1: true } };
    expect(lockIn(state, 'p1').patch).toEqual({});
  });

  it('keeps the players who locked in earlier', () => {
    const state = { ...filled(), locked: { p2: true } };
    expect(lockIn(state, 'p1').patch.locked).toEqual({ p1: true, p2: true });
  });

  it('refuses outright in a blind round', () => {
    expect(lockIn(startRound(players('p1'), DECK), 'p1').patch).toEqual({});
  });
});

describe('unplacedCards', () => {
  it('starts as the whole deck', () => {
    expect(unplacedCards(openRound(), 'p1')).toHaveLength(DECK.length);
  });

  it('drops each card as it lands, and returns it when the slot is cleared', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    expect(unplacedCards(state, 'p1').map((c) => c.id)).not.toContain('c');
    expect(unplacedCards(state, 'p1')).toHaveLength(DECK.length - 1);
    state = { ...state, ...clearSlot(state, 'p1', 3).patch };
    expect(unplacedCards(state, 'p1').map((c) => c.id)).toContain('c');
  });

  it('is per player, not per round', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    expect(unplacedCards(state, 'p2')).toHaveLength(DECK.length);
  });
});

describe('pendingPlacers, in an open round', () => {
  // The single branch point between the two modes: everyonePlaced delegates to
  // it, local play takes its head as the hot seat, online play renders it as
  // "waiting on…". Getting this right is what gives open rounds the same
  // departed-player escape hatches blind rounds already have.
  it('waits on whoever has not locked in, however full their board is', () => {
    let state = openRound();
    state = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    expect(pendingPlacers(state, ['p1', 'p2'])).toEqual(['p1', 'p2']);
    state = { ...state, locked: { p1: true } };
    expect(pendingPlacers(state, ['p1', 'p2'])).toEqual(['p2']);
  });

  it('lets everyonePlaced mean "everyone locked in"', () => {
    const state = { ...openRound(), locked: { p1: true, p2: true } };
    expect(everyonePlaced(state, ['p1', 'p2'])).toBe(true);
    // …and counts only the active ids, so a closed tab cannot hold the reveal.
    expect(everyonePlaced({ ...openRound(), locked: { p1: true } }, ['p1'])).toBe(true);
  });
});

describe('roundFinished', () => {
  it('ends a blind round when the deck runs out', () => {
    const state = startRound(players('p1'), DECK);
    expect(roundFinished(state, ['p1'])).toBe(false);
    expect(roundFinished({ ...state, cursor: DECK.length }, ['p1'])).toBe(true);
  });

  it('ends an open round when everyone active has locked in', () => {
    const state = openRound();
    expect(roundFinished(state, ['p1', 'p2'])).toBe(false);
    expect(roundFinished({ ...state, locked: { p1: true } }, ['p1', 'p2'])).toBe(false);
    expect(roundFinished({ ...state, locked: { p1: true, p2: true } }, ['p1', 'p2'])).toBe(true);
  });

  // The cursor never moves in an open round, so the blind test would call it
  // finished the moment it started.
  it('does not end an open round just because the cursor sits at zero', () => {
    expect(roundFinished({ ...openRound(), deck: [] }, ['p1'])).toBe(false);
  });

  it('never finishes an empty room', () => {
    expect(roundFinished(openRound(), [])).toBe(false);
  });
});

describe('roundUntouched', () => {
  // The window in which a departing opinion subject can still be replaced:
  // boards built while guessing at one person cannot honestly be rescored
  // against another.
  it('is true for a blind round nobody has advanced', () => {
    expect(roundUntouched(startRound(players('p1'), DECK))).toBe(true);
    expect(roundUntouched({ ...startRound(players('p1'), DECK), cursor: 1 })).toBe(false);
  });

  it('is true for a fresh open round', () => {
    expect(roundUntouched(openRound())).toBe(true);
  });

  // The trap this function exists for: an open round's cursor sits at 0 all the
  // way to the reveal, so the blind test would swap the answer key out from
  // under ten finished boards.
  it('goes false as soon as one card lands, though the cursor has not moved', () => {
    const state = openRound();
    const placed = { ...state, ...placeCard(state, 'p1', 'c', 3).patch };
    expect(placed.cursor).toBe(0);
    expect(roundUntouched(placed)).toBe(false);
  });

  it('goes false once anyone has locked in', () => {
    expect(roundUntouched({ ...openRound(), locked: { p1: true } })).toBe(false);
  });
});

describe('a whole open round, from deal to score', () => {
  // The sequence both screens actually drive: pick a card, drop it in a slot,
  // move one, take one back out, fill up, lock in. Worth having end to end
  // because the per-function tests above each start from a hand-built state,
  // and this is the only place the real order of operations is exercised.
  const fill = (state, id, order) => {
    let s = state;
    order.forEach((card, slot) => {
      s = { ...s, ...placeCard(s, id, card.id, slot).patch };
    });
    return s;
  };

  it('plays an opinion round through to a scored reveal', () => {
    const ids = ['p1', 'p2'];
    let state = startRound(players(...ids), DECK, 'p2', { blind: false });

    // p2 is the subject and ranks honestly — their board becomes the key.
    state = fill(state, 'p2', DECK);
    expect(roundFinished(state, ids)).toBe(false);
    state = { ...state, ...lockIn(state, 'p2').patch };

    // p1 guesses at them, changes their mind twice on the way.
    state = fill(state, 'p1', DECK);
    state = { ...state, ...clearSlot(state, 'p1', 9).patch };
    expect(unplacedCards(state, 'p1').map((c) => c.id)).toEqual(['j']);
    expect(lockIn(state, 'p1').patch).toEqual({});          // board has a hole
    state = { ...state, ...placeCard(state, 'p1', 'j', 9).patch };
    state = { ...state, ...lockIn(state, 'p1').patch };

    expect(roundFinished(state, ids)).toBe(true);
    // p1 matched the subject exactly, and the subject takes the mean of the
    // guesses made at them.
    const scores = finalScores(state, ids, { opinion: true, scoring: true });
    expect(scores.p1).toBe(DECK.length - 1);
    expect(scores.p2).toBe(DECK.length - 1);
  });

  it('ends a fact round the same way, scored against the deck', () => {
    let state = startRound(players('p1'), DECK, null, { blind: false });
    state = fill(state, 'p1', trueOrder(DECK));
    state = { ...state, ...lockIn(state, 'p1').patch };

    expect(roundFinished(state, ['p1'])).toBe(true);
    expect(scoreBoard(state.boards.p1, DECK, trueOrder(DECK)).perfect).toBe(true);
  });

  // The gate that stops one closed tab holding the reveal open forever, which
  // an open round needs just as much as a blind one.
  it('finishes on the active roster when someone leaves without locking in', () => {
    let state = startRound(players('p1', 'p2'), DECK, null, { blind: false });
    state = fill(state, 'p1', DECK);
    state = { ...state, ...lockIn(state, 'p1').patch };

    expect(roundFinished(state, ['p1', 'p2'])).toBe(false);  // still waiting on p2
    expect(roundFinished(state, ['p1'])).toBe(true);         // p2 dropped out
    // …and p2's board still exists to be shown at the reveal.
    expect(state.boards.p2).toBeDefined();
  });
});
