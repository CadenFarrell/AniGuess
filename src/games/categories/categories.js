// Every category AniTag can deal, plus the resolver that lets a player-written
// one travel beside a built-in. Adding a category means adding an entry here and
// nothing else: rules.js never learns what a category IS — it only ever moves an
// opaque spec around — and the screens read their prompt off the resolved object
// rather than hardcoding a clause.
//
// THE ONE RULE A NEW CATEGORY MUST OBEY:
//
//   `label` completes the sentence "Your category is …", and a human — never
//   this file — decides whether a proposal fits it.
//
// That is not a shortcut, it is the whole reason this game needs no AniList
// import. A profile stores id/title/characters plus five show stats and eight
// character fields (see CLAUDE.md); it has no studios, no tags, and no
// show-level genres. "Wears glasses" is therefore unanswerable by any code in
// this repo and always will be, so the judge is a person, so a proposal is free
// text, so nothing has to be drawn from anybody's list. Every attempt to make
// the app adjudicate ends by deleting most of this list.
//
// Deliberately a FORK of wavelength/spectra.js's discipline rather than an
// import — the same call anifake/utils/pool.js made against anirank's deck.js. A
// spectrum is two labels naming the ends of a dial and carries a direction rule
// that inverts every score if flipped; a category is one clause with no ends, no
// direction and nothing to invert. What IS copied is the part that generalises:
// a written category travels as its whole definition, and getCategory is the one
// place that knows the difference.

// A category is a clause, not a caption, so this is far longer than a spectrum's
// MAX_LABEL_LEN of 14 — "characters who die before the halfway point" has to
// fit. Matched to AniWave's MAX_CLUE_LEN for the reason that number exists: long
// enough for the thought the game is actually played with, short enough that
// nobody can smuggle a paragraph into a card.
export const MAX_LABEL_LEN = 48;

// EVERY CATEGORY DECLARES ITS POOL, and a session plays exactly one of them —
// see prefs.categoryPool. Mixing them within a session would be a real leak
// rather than a style choice: the hot seat cannot see their category, so the
// only way they know whether to name a show or a character is the prompt in
// front of them, and a per-player pool would make that prompt a clue about the
// category it is meant to hide. One pool per session, chosen at setup, tells
// everyone the same thing and tells nobody anything they should not have.
export const CATEGORIES = [
  // ---- characters ----
  { id: 'glasses', pool: 'characters', label: 'Wears glasses' },
  { id: 'villain', pool: 'characters', label: 'Is a villain' },
  { id: 'sword', pool: 'characters', label: 'Fights with a blade' },
  { id: 'dies', pool: 'characters', label: 'Dies in their own show' },
  { id: 'lead', pool: 'characters', label: 'Is the main character' },
  { id: 'nothuman', pool: 'characters', label: 'Is not human' },
  { id: 'sibling', pool: 'characters', label: 'Has a brother or sister' },
  { id: 'uniform', pool: 'characters', label: 'Wears a school uniform' },
  { id: 'blond', pool: 'characters', label: 'Is blond' },
  { id: 'loud', pool: 'characters', label: 'Never shuts up' },
  { id: 'roommate', pool: 'characters', label: 'Would be a nightmare roommate' },
  { id: 'orphan', pool: 'characters', label: 'Has no living parents' },
  { id: 'glowup', pool: 'characters', label: 'Starts weak and ends strong' },
  { id: 'redeemed', pool: 'characters', label: 'Was an enemy first' },

  // ---- shows ----
  { id: 'finished', pool: 'shows', label: 'Somebody here actually finished it' },
  { id: 'long', pool: 'shows', label: 'Runs more than fifty episodes' },
  { id: 'school', pool: 'shows', label: 'Is set at a school' },
  { id: 'cried', pool: 'shows', label: 'Made somebody here cry' },
  { id: 'film', pool: 'shows', label: 'Has a film as well as a series' },
  { id: 'old', pool: 'shows', label: 'Aired before you were born' },
  { id: 'noromance', pool: 'shows', label: 'Has no romance in it at all' },
  { id: 'rewatch', pool: 'shows', label: 'You would rewatch it tomorrow' },
  { id: 'sport', pool: 'shows', label: 'Is about a sport' },
  { id: 'dropped', pool: 'shows', label: 'Somebody here dropped it' },
];

// Only ever reached by a spec an older build wrote — see getCategory — never
// offered as a suggestion, so it does not need to be a good category, only a
// valid one.
export const DEFAULT_CATEGORY_ID = CATEGORIES[CATEGORIES.length - 1].id;

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/**
 * Resolves a spec into a full category.
 *
 * Four accepted shapes, mirroring wavelength's getSpectrum and anirank's getAxis
 * before it: a built-in's id, a stored custom, an already-resolved category, and
 * a bare `{ id }` wrapper. Carrying all four here is what lets every caller hold
 * "the category" without tracking which kind it has.
 *
 * THE CUSTOM BRANCH MUST COME FIRST. A stored custom carries an id that resolves
 * to nothing in BY_ID, so checking `spec.id` before `spec.custom` would silently
 * play every written category as DEFAULT_CATEGORY_ID on every device — and the
 * judge would then be answering yes/no against a clause its author never wrote,
 * which reads as the other players cheating rather than as a bug.
 *
 * Never returns undefined, for the reason getSpectrum doesn't: a spec can arrive
 * from a saved room written by an older build, and a turn that cannot name its
 * category renders a judge screen with nothing on it.
 */
export function getCategory(spec) {
  if (spec && typeof spec === 'object') {
    if (spec.custom) return customCategory(spec);
    if (spec.label) return spec;
    if (spec.id) return getCategory(spec.id);
  }
  return BY_ID.get(spec) ?? BY_ID.get(DEFAULT_CATEGORY_ID);
}

export const isCustom = (category) => category?.custom === true;

/** The id a spec is remembered by. Only ever persisted for a built-in. */
export const categoryIdOf = (spec) => (
  typeof spec === 'string' ? spec : spec?.id ?? DEFAULT_CATEGORY_ID
);

/** The clause itself — what a judge reads and what the reveal prints. */
export const categoryLabel = (spec) => getCategory(spec).label;

/**
 * Whether a category may be OFFERED for a session drawn from `pool`.
 *
 * A null pool means NO FILTER, and a category carrying no `pool` of its own is a
 * player-written one, which is never filtered: you wrote it, so you know which
 * pool it is for, and tagging customs would cost a field in a stored shape that
 * is deliberately one string and one boolean.
 */
export const categoryInPool = (c, pool) => (
  !pool || !c?.pool || c.pool === 'both' || c.pool === pool
);

/** How many categories a pool can offer — the setup screen warns below MIN. */
export const poolSize = (pool, extra = []) => (
  [...CATEGORIES, ...extra].filter((c) => categoryInPool(c, pool)).length
);

/**
 * What to OFFER a player who is picking their own clause (chosen mode).
 *
 * The same eligible list dealCategories draws from, only handed over whole
 * instead of sampled — which is the entire difference between the two modes at
 * this layer. Written categories come FIRST because a player who wrote one
 * wrote it to play it, and they are the entries that would otherwise be buried
 * under two dozen built-ins.
 *
 * Never filters `extra` by pool: a custom carries no `pool` of its own on
 * purpose (see categoryInPool), so the person who wrote it is the one who knows
 * which it is for.
 */
export function suggestionsFor(pool = null, extra = []) {
  const customs = extra.filter(Boolean);
  return [...customs, ...CATEGORIES.filter((c) => categoryInPool(c, pool))];
}

/**
 * One category each, all different.
 *
 * DISTINCT IS THE WHOLE REQUIREMENT, and it bites harder here than in
 * pickSpectra's "an offer of three where two are the same is not an offer of
 * three". Two players holding one clause means the table answers both with the
 * same yes/no, and the second of them is playing a game whose answer is already
 * on screen behind them.
 *
 * Draws by splicing a copy rather than by retrying, so it terminates when there
 * are fewer categories than players — and when it runs out it REFILLS from the
 * eligible list rather than returning short, because a player with no category
 * has no turn at all. A table of twelve on a pool of ten gets two repeats; a
 * table of four never does.
 *
 * `exclude` is last round's draw, kept out of this one so a short session does
 * not hand somebody back the clause they just solved. Falls back to the full
 * eligible list rather than to nothing when excluding would empty it.
 *
 * Returns a BUILT-IN AS ITS ID and a custom as its whole definition — the same
 * asymmetry getCategory resolves, for the reason spectra.js states: every device
 * ships every built-in, and a written one has been seen by exactly one.
 */
export function dealCategories(playerIds = [], rng = Math.random, {
  pool = null, extra = [], exclude = [],
} = {}) {
  const all = [...CATEGORIES, ...extra].filter(Boolean);
  const inPool = all.filter((c) => categoryInPool(c, pool));
  const eligible = inPool.length ? inPool : all;
  const excluded = new Set(exclude.map((s) => categoryIdOf(s)));
  const kept = eligible.filter((c) => !excluded.has(c.id));
  const from = kept.length ? kept : eligible;

  const out = {};
  let rest = [];
  for (const playerId of playerIds) {
    if (!rest.length) rest = [...from];
    const i = Math.min(rest.length - 1, Math.floor(rng() * rest.length));
    const [picked] = rest.splice(i, 1);
    if (picked) out[playerId] = picked.custom ? picked : picked.id;
  }
  return out;
}

// --- player-written categories -----------------------------------------------
//
// A stored custom is ONE STRING AND ONE BOOLEAN. No arrays, no nesting, and
// nothing that can legitimately be empty — deliberate, because this object
// travels through RTDB inside an assignments/ node, and every one of CLAUDE.md's
// storage traps is about a shape Realtime Database declines to store. Keep it
// this flat and none of them apply.

// AniFake's submitClue idiom — trim, collapse runs of whitespace, truncate.
// Deliberately NOT uppercased, unlike a spectrum's end caps: those are two words
// rendered as a pair of captions, while this is a sentence a judge reads.
const clean = (text, max) => (text || '')
  .trim()
  .replace(/\s+/g, ' ')
  .slice(0, max);

/**
 * Repairs a draft into the stored shape, or returns null when there is nothing
 * worth storing.
 *
 * Runs on every READ as well as every write (see useCustomCategories), so an
 * entry saved by an older build is repaired with no migration flag. Returning
 * null rather than defaulting the missing label is what lets the editor disable
 * its own save button on the same call it uses to preview the result.
 */
export function normalizeCustomCategory(draft) {
  const label = clean(draft?.label, MAX_LABEL_LEN);
  if (!label) return null;
  return {
    // Keeping an existing id is what makes the editor's save an UPDATE rather
    // than a duplicate — the same reason normalizeCustomSpectrum keeps one.
    id: draft?.id || `custom_${Date.now().toString(36)}`,
    label,
    custom: true,
  };
}

/**
 * Hydrates a stored custom into something a screen can render.
 *
 * Barely does anything today — a category is already only a label — and exists
 * so getCategory has one branch per shape and a future field lands here rather
 * than in six screens. Falls back to a built-in rather than returning null,
 * because getCategory's contract is that it never does.
 */
export function customCategory(saved) {
  return normalizeCustomCategory(saved) ?? BY_ID.get(DEFAULT_CATEGORY_ID);
}
