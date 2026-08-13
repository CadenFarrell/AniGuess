import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIER_LABELS, MAX_ROWS, RANKED_ROW_ID,
  addRow, clearRow, compareLists, fillRow, labelFor, moveCard, moveRow, newList,
  normalizeList, placedIds, rankOf, reconcileList, removeRow, renameRow, rowOf,
  setFormat, trayCards,
} from './tiers';

// A list from row labels → card ids, so a test reads as the board it describes.
const list = (rows, format = 'tiers') =>
  normalizeList({ id: 'tl_test', format, rows: rows.map(([label, cards]) => ({ label, cards })) });

const ranked = (cards) => normalizeList({ id: 'tl_test', format: 'ranked', rows: [{ cards }] });

// The pool: the cards utils/deck.js would have handed the builder.
const pool = (...ids) => ids.map((id) => ({ id, title: id, subtitle: '', imageUrl: '', value: null }));

const rowLabels = (l) => l.rows.map((r) => r.label);
const rowCards = (l) => l.rows.map((r) => r.cards);

describe('normalizeList', () => {
  // A card with two rows has two ranks, and rankOf/trayCards/compareLists would
  // then each answer differently about where it sits.
  it('drops a card that appears in more than one row, keeping the first', () => {
    const l = list([['S', ['a', 'b']], ['A', ['b', 'c']]]);
    expect(rowCards(l)).toEqual([['a', 'b'], ['c']]);
  });

  it('drops junk ids rather than storing them', () => {
    const l = normalizeList({ rows: [{ label: 'S', cards: ['a', '', null, 7, 'b'] }] });
    expect(l.rows[0].cards).toEqual(['a', 'b']);
  });

  it('flattens a ranked list into its one row, top row first', () => {
    const l = list([['S', ['a', 'b']], ['A', ['c']]], 'ranked');
    expect(l.rows).toHaveLength(1);
    expect(l.rows[0].id).toBe(RANKED_ROW_ID);
    expect(l.rows[0].cards).toEqual(['a', 'b', 'c']);
  });

  // Repair-on-read means this runs on every load; a normalize that kept changing
  // the shape would make every read look like an edit.
  it('is idempotent', () => {
    const once = list([['S', ['a']], ['A', ['b']]]);
    expect(normalizeList(once)).toEqual(once);
    const r = ranked(['a', 'b']);
    expect(normalizeList(r)).toEqual(r);
  });

  it('gives an empty list the default tiers', () => {
    expect(rowLabels(normalizeList({}))).toEqual(DEFAULT_TIER_LABELS);
  });

  it('cleans and uppercases row labels, and caps the row count', () => {
    expect(normalizeList({ rows: [{ label: '  go at  ' }] }).rows[0].label).toBe('GO A');
    expect(normalizeList({ rows: new Array(20).fill({ label: 'X' }) }).rows).toHaveLength(MAX_ROWS);
  });

  it('never leaves two rows sharing an id', () => {
    const ids = list([['S', []], ['A', []], ['B', []]]).rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// Publishing a list into a room sends it through Realtime Database, which does
// not store empty arrays or empty objects — so a list comes back in a shape no
// local save ever produces. normalizeList is what useAniRankRoom's
// normalizeState leans on to repair it, which is only true if it actually
// handles these; the alternative is a second normalizer that can disagree with
// this one about what a list is.
describe('normalizeList over an RTDB round trip', () => {
  // What RTDB gives back: any key whose value was [] or {} is simply absent.
  const throughRtdb = (value) => {
    if (Array.isArray(value)) {
      return value.length === 0 ? undefined : value.map(throughRtdb);
    }
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        const stripped = throughRtdb(v);
        if (stripped !== undefined) out[k] = stripped;
      }
      return Object.keys(out).length === 0 ? undefined : out;
    }
    return value;
  };

  it('keeps an empty row that RTDB dropped the cards array from', () => {
    const sent = list([['S', ['a']], ['A', []], ['B', ['b']]]);
    // The middle row survives as { id, label } with no `cards` at all.
    const stored = throughRtdb(sent);
    expect(stored.rows[1].cards).toBeUndefined();

    const back = normalizeList(stored);
    expect(rowLabels(back)).toEqual(['S', 'A', 'B']);
    expect(rowCards(back)).toEqual([['a'], [], ['b']]);
  });

  it('rebuilds a list where every row came back empty', () => {
    const back = normalizeList(throughRtdb(list([['S', []], ['A', []]])));
    expect(rowLabels(back)).toEqual(['S', 'A']);
    expect(rowCards(back)).toEqual([[], []]);
  });

  it('survives a completely empty list, which RTDB stores as nothing', () => {
    const back = normalizeList(throughRtdb(newList({ name: 'Empty' })));
    expect(back.rows).toHaveLength(DEFAULT_TIER_LABELS.length);
    expect(placedIds(back)).toEqual([]);
  });

  it('round-trips a populated list unchanged', () => {
    const sent = list([['S', ['a', 'b']], ['A', ['c']]]);
    expect(normalizeList(throughRtdb(sent))).toEqual(sent);
  });

  it('round-trips a ranked list, keeping its single row', () => {
    const sent = ranked(['a', 'b', 'c']);
    const back = normalizeList(throughRtdb(sent));
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0].id).toBe(RANKED_ROW_ID);
    expect(back.rows[0].cards).toEqual(['a', 'b', 'c']);
  });

  // The whole point of publishing: two devices that repaired the same stored
  // blob must be comparing the same list.
  it('agrees with itself after a round trip, so a comparison is unaffected', () => {
    const a = list([['S', ['a']], ['A', []], ['B', ['b', 'c']]]);
    const b = list([['S', ['a', 'b']], ['A', []], ['B', ['c']]]);
    const direct = compareLists(a, b);
    const viaRtdb = compareLists(normalizeList(throughRtdb(a)), normalizeList(throughRtdb(b)));
    expect(viaRtdb).toEqual(direct);
  });
});

describe('newList', () => {
  it('takes items and the axis id off the axis it was given', () => {
    const l = newList({ name: 'All-time', format: 'tiers', axis: { id: 'fight', items: 'characters' } });
    expect(l).toMatchObject({ name: 'All-time', axisId: 'fight', items: 'characters' });
    expect(rowLabels(l)).toEqual(DEFAULT_TIER_LABELS);
  });
});

describe('reconcileList', () => {
  it('drops ids the pool no longer has and counts them', () => {
    const { list: next, dropped } = reconcileList(list([['S', ['a', 'gone']], ['A', ['b']]]), pool('a', 'b'));
    expect(dropped).toBe(1);
    expect(rowCards(next)).toEqual([['a'], ['b']]);
  });

  // It runs on every render of the builder; a fresh object each time would
  // invalidate the memo around the O(n²) compare.
  it('returns the same object when nothing changed', () => {
    const l = list([['S', ['a']]]);
    expect(reconcileList(l, pool('a', 'b')).list).toBe(l);
  });
});

describe('trayCards', () => {
  it('is everything the rows do not hold, in pool order', () => {
    const t = trayCards(list([['S', ['b']]]), pool('a', 'b', 'c'));
    expect(t.map((c) => c.id)).toEqual(['a', 'c']);
  });

  // A show imported since the list was last opened simply appears — nothing to
  // migrate, which is the point of deriving rather than storing the tray.
  it('surfaces cards added to the pool after the list was saved', () => {
    expect(trayCards(list([['S', ['a']]]), pool('a', 'new')).map((c) => c.id)).toEqual(['new']);
  });
});

describe('moveCard', () => {
  const base = list([['S', ['a', 'b']], ['A', ['c']]]);

  it('appends to the end of the target row by default', () => {
    expect(rowCards(moveCard(base, 'c', 'r0'))).toEqual([['a', 'b', 'c'], []]);
  });

  it('inserts at an index', () => {
    expect(rowCards(moveCard(base, 'c', 'r0', 1))).toEqual([['a', 'c', 'b'], []]);
  });

  it('sends a card back to the tray with a null row', () => {
    expect(rowCards(moveCard(base, 'a', null))).toEqual([['b'], ['c']]);
  });

  // The index the player is looking at is the post-removal one. Getting this
  // wrong is off-by-one in exactly one of the four directions a card can travel.
  it('resolves the index after the lift, so a within-row move lands where aimed', () => {
    const l = list([['S', ['a', 'b', 'c']]]);
    expect(rowCards(moveCard(l, 'a', 'r0', 2))).toEqual([['b', 'c', 'a']]);
    expect(rowCards(moveCard(l, 'c', 'r0', 0))).toEqual([['c', 'a', 'b']]);
  });

  it('clamps an index past either end', () => {
    expect(rowCards(moveCard(base, 'c', 'r0', 99))).toEqual([['a', 'b', 'c'], []]);
    expect(rowCards(moveCard(base, 'c', 'r0', -5))).toEqual([['c', 'a', 'b'], []]);
  });

  // A stale render can hand over a row deleted a tap ago — refuse, don't throw.
  it('refuses an unknown row or a missing card', () => {
    expect(moveCard(base, 'a', 'nope')).toBe(base);
    expect(moveCard(base, null, 'r0')).toBe(base);
  });

  it('never leaves a card in two rows', () => {
    const moved = moveCard(base, 'a', 'r1');
    expect(placedIds(moved).filter((id) => id === 'a')).toHaveLength(1);
  });
});

describe('fillRow and clearRow', () => {
  it('fillRow sweeps the whole tray into one row, in pool order', () => {
    const l = fillRow(list([['S', []], ['A', ['b']]]), 'r0', pool('a', 'b', 'c'));
    expect(rowCards(l)).toEqual([['a', 'c'], ['b']]);
  });

  it('clearRow empties one row back to the tray', () => {
    expect(rowCards(clearRow(list([['S', ['a']], ['A', ['b']]]), 'r0'))).toEqual([[], ['b']]);
  });
});

describe('row editing', () => {
  it('addRow names the row from the first unused label', () => {
    expect(rowLabels(addRow(list([['S', []], ['B', []]])))).toEqual(['S', 'B', 'A']);
  });

  it('addRow inserts at a position and caps the row count', () => {
    expect(rowLabels(addRow(list([['S', []], ['B', []]]), 1))).toEqual(['S', 'A', 'B']);
    const full = list(new Array(MAX_ROWS).fill(0).map((_, i) => [`${i}`, []]));
    expect(addRow(full)).toBe(full);
  });

  // Deleting a row edits the scale; it does not retract the judgements made on
  // it. At two hundred cards, emptying them to the tray is work nobody redoes.
  it('removeRow drops its cards into the row above', () => {
    const l = removeRow(list([['S', ['a']], ['A', ['b']], ['B', ['c']]]), 'r1');
    expect(rowLabels(l)).toEqual(['S', 'B']);
    expect(rowCards(l)).toEqual([['a', 'b'], ['c']]);
  });

  it('removeRow drops the first row into the one below it', () => {
    const l = removeRow(list([['S', ['a']], ['A', ['b']]]), 'r0');
    expect(rowLabels(l)).toEqual(['A']);
    expect(rowCards(l)).toEqual([['b', 'a']]);
  });

  // A list with no rows has nowhere to put a card.
  it('removeRow refuses the last row', () => {
    const one = list([['S', ['a']]]);
    expect(removeRow(one, 'r0')).toBe(one);
  });

  it('renameRow cleans, uppercases, and refuses to blank a label', () => {
    const l = list([['S', []]]);
    expect(renameRow(l, 'r0', ' goat ').rows[0].label).toBe('GOAT');
    expect(renameRow(l, 'r0', '   ')).toBe(l);
  });

  it('moveRow swaps neighbours and carries their cards', () => {
    const l = moveRow(list([['S', ['a']], ['A', ['b']]]), 'r1', -1);
    expect(rowLabels(l)).toEqual(['A', 'S']);
    expect(rowCards(l)).toEqual([['b'], ['a']]);
  });

  it('moveRow refuses to walk off either end', () => {
    const l = list([['S', []], ['A', []]]);
    expect(moveRow(l, 'r0', -1)).toBe(l);
    expect(moveRow(l, 'r1', 1)).toBe(l);
  });

  it('leaves the single row of a ranked list alone', () => {
    const r = ranked(['a', 'b']);
    expect(addRow(r)).toBe(r);
    expect(removeRow(r, RANKED_ROW_ID)).toBe(r);
    expect(moveRow(r, RANKED_ROW_ID, 1)).toBe(r);
  });
});

describe('setFormat', () => {
  it('flattens to ranked top row first', () => {
    const r = setFormat(list([['S', ['a', 'b']], ['A', ['c']]]), 'ranked');
    expect(r.format).toBe('ranked');
    expect(r.rows[0].cards).toEqual(['a', 'b', 'c']);
  });

  it('cuts a ranking into contiguous tiers', () => {
    const t = setFormat(ranked(['a', 'b', 'c', 'd']), 'tiers', ['S', 'A']);
    expect(rowLabels(t)).toEqual(['S', 'A']);
    expect(rowCards(t)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  // Chunking preserves order, so this direction round-trips. The other does not,
  // and must not: a tier list never had an order inside its rows to recover.
  it('round-trips ranked → tiers → ranked', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const back = setFormat(setFormat(ranked(order), 'tiers'), 'ranked');
    expect(back.rows[0].cards).toEqual(order);
  });

  it('is a no-op for the format it already has, or an unknown one', () => {
    const l = list([['S', ['a']]]);
    expect(setFormat(l, 'tiers')).toBe(l);
    expect(setFormat(l, 'nonsense')).toBe(l);
  });
});

describe('rankOf and labelFor', () => {
  // Everything in S is equally S. compareLists must not read an order out of the
  // array a row happens to be stored in.
  it('gives every card in a tier the same rank', () => {
    expect(rankOf(list([['S', ['a', 'b']], ['A', ['c']]]))).toEqual({ a: 0, b: 0, c: 1 });
  });

  it('gives every card in a ranking its own rank', () => {
    expect(rankOf(ranked(['a', 'b', 'c']))).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('reads placement as a tier label or a position, and null when unplaced', () => {
    expect(labelFor(list([['S', ['a']]]), 'a')).toBe('S');
    expect(labelFor(ranked(['a', 'b', 'c']), 'c')).toBe('#3');
    expect(labelFor(list([['S', ['a']]]), 'zzz')).toBeNull();
  });

  it('rowOf finds the row holding a card', () => {
    expect(rowOf(list([['S', ['a']], ['A', ['b']]]), 'b').label).toBe('A');
    expect(rowOf(list([['S', ['a']]]), 'b')).toBeNull();
  });
});

describe('compareLists', () => {
  it('scores a list against itself as total agreement', () => {
    const l = list([['S', ['a']], ['A', ['b']], ['B', ['c']]]);
    const r = compareLists(l, l);
    expect(r.comparisons).toBe(3);
    expect(r.agree).toBe(3);
    expect(r.clashes).toEqual([]);
  });

  // Two people's lists are equals: a measure that changes when you swap the
  // arguments is not a measure of agreement. This is the whole reason
  // rules.js's scoreBoard — which forgives only the answer key's ties — is not
  // reused here.
  it('is symmetric in its arguments', () => {
    const a = list([['S', ['x', 'y']], ['A', ['z']], ['B', ['w']]]);
    const b = ranked(['z', 'w', 'x', 'y']);
    const ab = compareLists(a, b);
    const ba = compareLists(b, a);
    expect(ab.agree).toBe(ba.agree);
    expect(ab.comparisons).toBe(ba.comparisons);
    expect(ab.clashes.map((c) => [c.id, c.conflicts]))
      .toEqual(ba.clashes.map((c) => [c.id, c.conflicts]));
  });

  it('forgives a tie from either side', () => {
    const tied = list([['S', ['a', 'b']]]);          // makes no claim about a vs b
    const strict = ranked(['b', 'a']);               // says b beats a
    expect(compareLists(tied, strict)).toMatchObject({ agree: 1, comparisons: 1 });
    expect(compareLists(strict, tied)).toMatchObject({ agree: 1, comparisons: 1 });
  });

  it('counts a genuine inversion once, and blames both cards for it', () => {
    const r = compareLists(ranked(['a', 'b']), ranked(['b', 'a']));
    expect(r).toMatchObject({ agree: 0, comparisons: 1 });
    expect(r.clashes.map((c) => c.conflicts)).toEqual([1, 1]);
  });

  // Sum of conflicts is twice the number of disagreeing pairs — the identity
  // explainBoard relies on, and the reason conflicts is honest blame.
  it('sums conflicts to twice the disagreeing pairs', () => {
    const r = compareLists(ranked(['a', 'b', 'c', 'd']), ranked(['d', 'c', 'b', 'a']));
    const total = r.clashes.reduce((n, c) => n + c.conflicts, 0);
    expect(total).toBe(2 * (r.comparisons - r.agree));
  });

  it('sorts clashes worst first and reports each side in its own terms', () => {
    // The two lists disagree about a vs b and about nothing else, so those two
    // cards carry one conflict each and c carries none.
    const r = compareLists(list([['S', ['a']], ['A', ['b']], ['B', ['c']]]), ranked(['b', 'a', 'c']));
    expect(r.clashes[0]).toMatchObject({ id: 'a', conflicts: 1, labelA: 'S', labelB: '#2' });
    expect(r.clashes.map((c) => c.id)).toEqual(['a', 'b']);
  });

  // A show one person has never seen is not a disagreement; folding it in would
  // make the bigger list look more wrong the more of it there was.
  it('compares only the cards both lists place, and names the rest', () => {
    const r = compareLists(list([['S', ['a', 'mine']]]), list([['S', ['a', 'yours']]]));
    expect(r).toMatchObject({ shared: 1, comparisons: 0, agree: 0 });
    expect(r.onlyA).toEqual(['mine']);
    expect(r.onlyB).toEqual(['yours']);
  });
});
