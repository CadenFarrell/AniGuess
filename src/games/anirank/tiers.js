// Tier lists: the whole-collection half of AniRank. No React, no storage, no
// network — the same invariant rules.js holds, and for the same reason. The
// hook that persists these (hooks/useTierLists.js) and the screens that draw
// them contain no logic of their own.
//
// The difference from rules.js is what a list IS FOR. A round deals ten cards
// and scores one board against an answer key; a tier list takes EVERY show or
// character on a profile, has no answer key at all, and is kept afterwards. So
// none of rules.js applies: no deck, no cursor, no score. What they share is
// the card shape utils/deck.js already produces, and one idea below borrowed on
// purpose (see compareLists).
//
// ONE SHAPE COVERS BOTH FORMATS, and that is the load-bearing decision here:
//
//   tiers   N labelled rows (S/A/B/C/D). Order WITHIN a row means nothing —
//           everything in S is equally S — so cards sharing a row tie.
//   ranked  exactly ONE row whose `cards` array is the entire 1..N ordering.
//
// A "numbered list" is therefore not a second data structure, it is a tier list
// that happens to have one row, and every mutator, every test and the whole
// compare path is written once. Only the renderer branches. This is the trick
// rules.js plays with pendingPlacers: branch at the single point the two modes
// genuinely differ, and nowhere else. Getting this wrong means two move
// implementations that drift, which is the exact failure the rules.js/hooks
// split exists to prevent.
//
// The stored shape is ids, strings and numbers — nothing else:
//
//   { id, name, format, axisId, items, rows: [{ id, label, cards: [cardId] }], updatedAt }
//
// CARDS ARE STORED BY FOLDED KEY, NEVER BY AniList id. normalizeProfile runs
// dedupeProfileAnimeList on EVERY read, which rewrites an entry's `id` and
// `title` to the best member of its franchise — so a list keyed on anime.id
// would quietly lose entries between two sessions with no import in between.
// The ids here are exactly what utils/deck.js stamps on a card
// (franchiseTitleKey for shows, characterNameKey for characters), which is also
// why a list and a round can never disagree about what one card is.
//
// Storing ids and not card objects is the other half of that: aniguess_profiles
// is already several hundred KB, shared/services/storage swallows a quota
// failure with a console.error, and a silent save loss is indistinguishable
// from a successful one. Two hundred short strings cost a few KB; two hundred
// card objects with cover URLs and subtitles do not.

import { DEFAULT_AXIS_ID } from './axes';

export const TIER_FORMATS = ['tiers', 'ranked'];

// The one row a 'ranked' list has. A constant rather than an invented id so
// normalizeList is idempotent: re-normalizing a ranked list has to produce the
// same row id it produced last time, or every read would look like an edit.
export const RANKED_ROW_ID = 'rank';

// Labels a new row is named from, first unused one wins. S/A/B/C/D is what
// people expect; the rest exist so addRow never has to invent a name.
const LABEL_POOL = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
export const DEFAULT_TIER_LABELS = ['S', 'A', 'B', 'C', 'D'];

export const MAX_ROWS = LABEL_POOL.length;
export const MAX_LIST_NAME_LEN = 40;
export const MAX_ROW_LABEL_LEN = 4;

// The axes.js clean() idiom: trim, collapse runs of whitespace, then truncate.
// Applied on read as well as write, so text that arrived from storage is
// cleaned by the same rule as text being typed.
const clean = (text, max) => (text || '').trim().replace(/\s+/g, ' ').slice(0, max);

const isFormat = (f) => TIER_FORMATS.includes(f);

// --- Building and repairing -------------------------------------------------

/** A fresh list. `axis` is an already-resolved axis (see axes.js getAxis). */
export function newList({ name = '', format = 'tiers', axis } = {}) {
  return normalizeList({
    id: `tl_${Date.now().toString(36)}`,
    name,
    format,
    axisId: axis?.id ?? DEFAULT_AXIS_ID,
    items: axis?.items === 'characters' ? 'characters' : 'shows',
    rows: DEFAULT_TIER_LABELS.map((label) => ({ label, cards: [] })),
    updatedAt: 0,
  });
}

/**
 * Repairs anything into the stored shape.
 *
 * Runs on every READ as well as every write — the normalizeCustomPrompt /
 * normalizeProfile idiom — so a list saved by an older build is fixed with no
 * migration flag and no version field to keep in step.
 *
 * Three repairs matter enough to name:
 *
 *  - A card id appearing in two rows is dropped from all but the first. That is
 *    not paranoia about corrupt storage: a card in two rows has two ranks, and
 *    every consumer below (rankOf, compareLists, trayCards) would then quietly
 *    disagree with itself about where it sits.
 *  - A 'ranked' list is FLATTENED to its single row here rather than in the
 *    screen, so switching format is just a field change plus a normalize.
 *  - Row ids are regenerated from position, so two rows can never share one.
 *    Nothing outside a single edit keeps a row id, so there is nothing to break.
 */
export function normalizeList(raw) {
  const format = isFormat(raw?.format) ? raw.format : 'tiers';

  // Every card id, in row order, with duplicates and junk removed. Built before
  // the rows are rebuilt because de-duplication is global: it cannot be decided
  // one row at a time.
  const seen = new Set();
  const keep = (cards) => {
    const out = [];
    for (const id of Array.isArray(cards) ? cards : []) {
      if (typeof id !== 'string' || !id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };

  const rawRows = Array.isArray(raw?.rows) ? raw.rows : [];
  let rows = rawRows.slice(0, MAX_ROWS).map((row, i) => ({
    id: `r${i}`,
    label: clean(row?.label, MAX_ROW_LABEL_LEN).toUpperCase() || LABEL_POOL[i] || `${i + 1}`,
    cards: keep(row?.cards),
  }));

  if (format === 'ranked') {
    // One row holding everything, in the order the rows were in. A tiers list
    // converted this way keeps the ordering its tiers expressed, which is the
    // whole point of converting rather than starting over.
    rows = [{ id: RANKED_ROW_ID, label: '', cards: rows.flatMap((r) => r.cards) }];
  } else if (!rows.length) {
    rows = DEFAULT_TIER_LABELS.map((label, i) => ({ id: `r${i}`, label, cards: [] }));
  }

  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `tl_${Date.now().toString(36)}`,
    name: clean(raw?.name, MAX_LIST_NAME_LEN),
    format,
    axisId: typeof raw?.axisId === 'string' && raw.axisId ? raw.axisId : DEFAULT_AXIS_ID,
    items: raw?.items === 'characters' ? 'characters' : 'shows',
    rows,
    updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : 0,
  };
}

/**
 * Drops cards that are no longer in the pool → { list, dropped }.
 *
 * A saved list outlives the profile it was built from: a show removed from the
 * anime list, or a re-import that folded two seasons into one franchise, leaves
 * ids behind that no card answers to. Those have to go before anything indexes
 * by them, and the count is returned rather than swallowed so the builder can
 * say "3 shows are no longer on your list" instead of silently shrinking.
 *
 * Returns the SAME list object when nothing changed. This runs on every render
 * of the builder, and a fresh object each time would invalidate every useMemo
 * downstream — including the O(n²) compare.
 */
export function reconcileList(list, cards) {
  const known = new Set((cards ?? []).map((c) => c?.id));
  let dropped = 0;
  const rows = list.rows.map((row) => {
    const kept = row.cards.filter((id) => known.has(id));
    dropped += row.cards.length - kept.length;
    return kept.length === row.cards.length ? row : { ...row, cards: kept };
  });
  return dropped === 0 ? { list, dropped } : { list: { ...list, rows }, dropped };
}

// --- Reading ----------------------------------------------------------------

/** Every placed card id, top row first. */
export function placedIds(list) {
  return list.rows.flatMap((r) => r.cards);
}

/**
 * The cards not in any row, in pool order.
 *
 * Derived, never stored — the same call rules.js makes with unplacedCards. A
 * stored tray is a second copy of the same fact and can disagree with the rows;
 * a derived one cannot, and it also means a show added to the profile since the
 * list was last opened simply appears, with nothing to migrate.
 */
export function trayCards(list, cards) {
  const placed = new Set(placedIds(list));
  return (cards ?? []).filter((c) => c?.id && !placed.has(c.id));
}

/** Which row holds a card, or null. */
export function rowOf(list, cardId) {
  return list.rows.find((r) => r.cards.includes(cardId)) ?? null;
}

/**
 * { cardId: rank } — the one number every comparison reads. Lower is better,
 * matching the board convention that slot 1 is the top.
 *
 * The two formats disagree about what a rank IS, and that disagreement is the
 * whole reason ties exist here:
 *
 *   tiers   the ROW INDEX. Everything in S shares rank 0, so a tier list makes
 *           no claim about the order inside a row — and compareLists must not
 *           invent one by reading the array order it happens to be stored in.
 *   ranked  the POSITION. Every card has its own rank; there are no ties.
 *
 * Same collapse rules.js's rankMap performs for the same reason: downstream
 * code compares ranks and never asks which mode produced them.
 */
export function rankOf(list) {
  const out = {};
  if (list.format === 'ranked') {
    const cards = list.rows[0]?.cards ?? [];
    for (let i = 0; i < cards.length; i++) out[cards[i]] = i;
    return out;
  }
  for (let i = 0; i < list.rows.length; i++) {
    for (const id of list.rows[i].cards) out[id] = i;
  }
  return out;
}

/**
 * How a card's placement reads to a human: 'S' in a tier list, '#12' in a
 * ranked one. Returns null for a card the list does not place.
 *
 * Needed because rankOf's numbers are not comparable ACROSS formats — tier 2
 * and position 2 are not the same claim — so the compare screen must print
 * labels rather than the ranks it scored with.
 */
export function labelFor(list, cardId) {
  if (list.format === 'ranked') {
    const i = (list.rows[0]?.cards ?? []).indexOf(cardId);
    return i < 0 ? null : `#${i + 1}`;
  }
  return rowOf(list, cardId)?.label ?? null;
}

// --- Moving cards -----------------------------------------------------------

/**
 * The single mutator: lift a card from wherever it is and put it somewhere.
 *
 * One rule covers every gesture the builder has, which is what keeps tap and
 * drag from being two implementations:
 *
 *   the card leaves whatever row it was in, and lands in `toRowId` at
 *   `toIndex` — or in the tray, which is simply the absence of a row.
 *
 * So tapping a tray card onto a row appends, dragging between rows moves, and
 * dropping a card above another in its own row reorders. RankBoard's placeCard
 * states its one rule the same way and for the same reason.
 *
 * `toIndex` is resolved AFTER the removal, so moving a card down inside its own
 * row means the index the player is looking at — the alternative is off-by-one
 * in exactly one of the four directions a card can travel, which is the kind of
 * bug that only shows up in the gesture nobody tested.
 *
 * Refuses rather than throws on an unknown row, matching every mutator in
 * rules.js: a stale render can hand over a row that was deleted a tap ago.
 */
export function moveCard(list, cardId, toRowId, toIndex = null) {
  if (!cardId) return list;
  if (toRowId != null && !list.rows.some((r) => r.id === toRowId)) return list;

  const rows = list.rows.map((row) => (
    row.cards.includes(cardId) ? { ...row, cards: row.cards.filter((id) => id !== cardId) } : row
  ));

  // Back to the tray. Returning the SAME object when the card was already there
  // matters: the builder saves on every change, so a no-op drop would otherwise
  // write to storage and re-stamp updatedAt for nothing.
  if (toRowId == null) return rowOf(list, cardId) ? { ...list, rows } : list;

  const next = rows.map((row) => {
    if (row.id !== toRowId) return row;
    const at = toIndex == null
      ? row.cards.length
      : Math.max(0, Math.min(row.cards.length, toIndex));
    const cards = [...row.cards];
    cards.splice(at, 0, cardId);
    return { ...row, cards };
  });
  return { ...list, rows: next };
}

/** Everything currently in the tray, into one row. The bulk gesture a 200-show list needs. */
export function fillRow(list, toRowId, cards) {
  const tray = trayCards(list, cards);
  return tray.reduce((acc, card) => moveCard(acc, card.id, toRowId), list);
}

/** Empties a row back to the tray. */
export function clearRow(list, rowId) {
  return { ...list, rows: list.rows.map((r) => (r.id === rowId ? { ...r, cards: [] } : r)) };
}

// --- Editing rows -----------------------------------------------------------

export function addRow(list, atIndex = null) {
  if (list.format === 'ranked' || list.rows.length >= MAX_ROWS) return list;
  const used = new Set(list.rows.map((r) => r.label));
  const label = LABEL_POOL.find((l) => !used.has(l)) ?? `${list.rows.length + 1}`;
  const at = atIndex == null
    ? list.rows.length
    : Math.max(0, Math.min(list.rows.length, atIndex));
  const rows = [...list.rows];
  rows.splice(at, 0, { id: `r${at}`, label, cards: [] });
  // Re-normalized rather than spliced-and-returned: row ids are positional, so
  // an insert renumbers every row after it.
  return normalizeList({ ...list, rows });
}

/**
 * Removes a row. Its cards fall into the ADJACENT row — the one above, or the
 * one below when the first row goes — rather than back to the tray.
 *
 * Deleting a row is an edit to the scale, not a retraction of the judgements
 * made on it: someone collapsing five tiers into four still thinks those shows
 * are good. Emptying them to the tray would throw that away, and at two hundred
 * cards it is not work anyone will redo.
 *
 * The last row cannot go, because a list with no rows has nowhere to put a card.
 */
export function removeRow(list, rowId) {
  if (list.format === 'ranked' || list.rows.length <= 1) return list;
  const i = list.rows.findIndex((r) => r.id === rowId);
  if (i < 0) return list;

  const orphans = list.rows[i].cards;
  const into = i === 0 ? 1 : i - 1;
  const rows = list.rows
    .map((row, j) => (j === into ? { ...row, cards: [...row.cards, ...orphans] } : row))
    .filter((_, j) => j !== i);
  return normalizeList({ ...list, rows });
}

export function renameRow(list, rowId, label) {
  const text = clean(label, MAX_ROW_LABEL_LEN).toUpperCase();
  if (!text) return list;
  return { ...list, rows: list.rows.map((r) => (r.id === rowId ? { ...r, label: text } : r)) };
}

/** Moves a row one place up (-1) or down (+1), carrying its cards. */
export function moveRow(list, rowId, delta) {
  if (list.format === 'ranked') return list;
  const i = list.rows.findIndex((r) => r.id === rowId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.rows.length) return list;
  const rows = [...list.rows];
  [rows[i], rows[j]] = [rows[j], rows[i]];
  return normalizeList({ ...list, rows });
}

// --- Format conversion ------------------------------------------------------

/**
 * Switches a list between formats without losing the work in it.
 *
 * → ranked  concatenates the rows top-first. normalizeList already does exactly
 *           this for any list carrying format 'ranked', so the conversion is a
 *           field change and nothing more.
 * → tiers   cuts the single ordering into `labels.length` contiguous chunks. A
 *           strict ranking already contains a tiering; slicing it is the only
 *           conversion that does not ask the player to start again.
 *
 * The two are inverses in one direction only, and deliberately: split then
 * flatten returns the original order, because chunking preserves it. Flatten
 * then split does NOT return the original tiers, because a tier list never had
 * an order inside its rows to recover.
 */
export function setFormat(list, format, labels = DEFAULT_TIER_LABELS) {
  if (!isFormat(format) || format === list.format) return list;
  if (format === 'ranked') return normalizeList({ ...list, format });

  const all = placedIds(list);
  const n = Math.max(1, labels.length);
  const per = Math.ceil(all.length / n) || 1;
  const rows = labels.map((label, i) => ({ label, cards: all.slice(i * per, (i + 1) * per) }));
  return normalizeList({ ...list, format, rows });
}

// --- Comparing two lists ----------------------------------------------------

/**
 * How much two lists agree → { shared, onlyA, onlyB, agree, comparisons, clashes }.
 *
 * DELIBERATELY NOT rules.js's scoreBoard, and the reason is worth stating
 * because reusing it looks free. scoreBoard measures a board against an ANSWER
 * KEY: rankMap collapses the key's ties and the `ra <= rb` test forgives them,
 * so only one side's ties are free. That is right when one side is the truth.
 * Here neither is — two people's tier lists are equals — and a measure that
 * changes when you swap the arguments is not a measure of agreement. So both
 * sides' ties are forgiven, which is the same generosity stated symmetrically.
 *
 * `comparisons` counts only pairs BOTH lists place. A show one person has never
 * seen is not a disagreement, and folding it in would make a bigger list look
 * more wrong the more of it there was.
 *
 * `clashes` is per-card CONFLICT COUNT — how many other cards this one is
 * ordered oppositely against — sorted worst first, never the difference between
 * two tier indices. That distinction is inherited from explainBoard, where it
 * was learned the hard way: positional distance is a bad proxy for blame,
 * because a card can sit rows away from where the other person put it and be
 * inverted against nothing, and it is also the only measure that survives
 * comparing a tier list against a ranked one, where "tier 2" and "position 2"
 * are not the same claim at all. Summed over the board, conflicts is exactly
 * twice the number of disagreeing pairs — the same identity explainBoard
 * relies on.
 */
export function compareLists(a, b) {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const idsA = placedIds(a);
  const idsB = new Set(placedIds(b));

  const shared = idsA.filter((id) => idsB.has(id));
  const onlyA = idsA.filter((id) => !idsB.has(id));
  const onlyB = [...idsB].filter((id) => ra[id] == null);

  const conflicts = new Map(shared.map((id) => [id, 0]));
  let agree = 0;
  let comparisons = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const x = shared[i];
      const y = shared[j];
      comparisons++;
      const da = Math.sign(ra[x] - ra[y]);
      const db = Math.sign(rb[x] - rb[y]);
      // A tie on EITHER side is agreement: that side made no claim about this
      // pair, so there is nothing for the other to contradict.
      if (da === 0 || db === 0 || da === db) {
        agree++;
      } else {
        conflicts.set(x, conflicts.get(x) + 1);
        conflicts.set(y, conflicts.get(y) + 1);
      }
    }
  }

  const clashes = shared
    .filter((id) => conflicts.get(id) > 0)
    .map((id) => ({
      id,
      conflicts: conflicts.get(id),
      labelA: labelFor(a, id),
      labelB: labelFor(b, id),
    }))
    // Ties broken by id so both devices — and both argument orders — produce the
    // identical list. Same reason trueOrder tie-breaks on title.
    .sort((x, y) => y.conflicts - x.conflicts || x.id.localeCompare(y.id));

  return { shared: shared.length, onlyA, onlyB, agree, comparisons, clashes };
}
