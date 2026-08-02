import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE, normalizeBoard, normalizeBoards, placedCount, startRound, currentItem,
  pendingPlacers, placeItem, everyonePlaced, advanceCursor, trueOrder, scoreBoard,
  finalScores, applyRoundScores,
} from './rules';

const show = (id, year) => ({ id, title: id, year, coverImageUrl: '' });
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
  it('sorts oldest first', () => {
    expect(trueOrder(DECK).map((s) => s.year)).toEqual([1988, 1995, 1998, 2001, 2006, 2009, 2013, 2016, 2020, 2022]);
  });

  it('breaks year ties by title so every device computes the same answer', () => {
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
    // order, dropping the newest show into the middle breaks only the pair it
    // now sits in front of. The eight shows around it keep their points.
    const board = perfectBoard();
    board.splice(4, 0, board.pop());     // 2022 moved from last to slot 4
    expect(scoreBoard(board, DECK).ordered).toBe(8);

    // Same for the oldest show sent to the end.
    const other = perfectBoard();
    other.push(other.shift());           // 1988 moved from first to last
    expect(scoreBoard(other, DECK).ordered).toBe(8);

    // Only a thoroughly wrong board loses everything.
    expect(scoreBoard([...perfectBoard()].reverse(), DECK).ordered).toBe(0);
  });

  it('never penalises two shows from the same year, whichever way round they sit', () => {
    const deck = [show('a', 2000), show('b', 2000)];
    expect(scoreBoard([deck[0], deck[1]], deck).ordered).toBe(1);
    expect(scoreBoard([deck[1], deck[0]], deck).ordered).toBe(1);
  });

  it('scores an unfinished board on the pairs it does have', () => {
    const board = new Array(10).fill(null);
    board[0] = show('h', 1988);
    board[1] = show('d', 1995);
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
