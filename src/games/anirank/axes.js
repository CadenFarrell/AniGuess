// Every way AniRank can be played. Adding a mode means adding an entry here and
// nothing else: rules.js never learns what it is ranking (the deck builder
// stamps a `value` on each card), and the screens read their labels off the axis
// rather than hardcoding "OLDEST → NEWEST".
//
// Two kinds, and the difference is where the answer key comes from:
//
//   fact     the deck itself. `valueFor` pulls one number off an item and
//            trueOrder sorts by it.
//   opinion  a player. One person is the round's subject, everyone ranks the
//            cards as that person would, and the subject's own finished board is
//            the answer key. No `valueFor` — there is nothing objective to sort.
//
// A player's own written prompt is the second kind and nothing more: it has no
// number to sort by, so it takes the opinion path end to end and no game logic
// had to learn about it. See customAxis at the bottom of this file.
//
// `items` decides which pool the deck is drawn from: a profile's shows, or the
// characters inside them.
//
// `defaultBlind` decides which way the round is dealt, and the host can override
// it per round (see the "Blind ranking" toggle in the setup screens):
//
//   true   cards arrive one at a time on a shared cursor and a placed card can
//          never be moved. Right for facts, where the game IS committing under
//          pressure without knowing what is still to come.
//   false  all ten cards are on the table at once and can be rearranged until
//          the player locks in. Right for opinions — and not merely nicer, since
//          the subject's own board is the answer key everyone else is scored
//          against. Dealt blind, that key records the order the cards happened to
//          arrive in as much as what the subject actually thinks.

import { characterNameKey } from '../../shared/utils/character';

// `valueFor`, NOT `valueOf`: every object inherits Object.prototype.valueOf, so
// an opinion axis that simply omits the field would still answer to `.valueOf`
// with an inherited function. Any "does this axis have one?" check would be
// silently true for every axis, on every object in the app.
//
// A fact axis needs a number on every card, and the profile fields that carry
// one only arrived with the import fix — an entry saved before it has none.
// Returning null (rather than 0) is what lets buildDeck drop the item instead of
// sorting an unknown to the front, and what lets the setup screen say "re-import
// to play this mode" rather than silently dealing a broken round.
const num = (v) => (Number.isFinite(v) ? v : null);

// Which end of the board is which, and the one rule a new axis must obey:
//
//   SLOT 1 IS THE TOP OF THE RANKING — the MOST of whatever this axis measures.
//
// So `topLabel` names the biggest `value` and `bottomLabel` the smallest, and
// rules.js's trueOrder sorts descending to match. The fields are named for the
// ends of the *board* rather than the ends of the scale on purpose: the previous
// `lowLabel`/`highLabel` pair said nothing about which way a vertical list runs,
// and duly ended up pointing the opposite way to the sort.
//
// `label` and `prompt` read top-to-bottom for the same reason — a mode called
// "Worst → Best" above a board whose first slot is the best is a contradiction
// the player has to resolve mid-round.
export const AXES = [
  // ---- facts: shows -------------------------------------------------------
  {
    id: 'year',
    kind: 'fact',
    items: 'shows',
    defaultBlind: true,
    label: 'Release date',
    prompt: 'Rank these shows newest to oldest.',
    topLabel: 'NEWEST',
    bottomLabel: 'OLDEST',
    // A franchise is dated by its first season — summarizeGroupStats stores the
    // earliest member's date, and the deck builder collapses seasons the same way.
    // The 1900 floor rejects AniList's placeholder dates, not real old anime.
    valueFor: (show) => {
      const year = num(show?.startDate?.year);
      return year != null && year > 1900 ? year : null;
    },
    format: (v) => String(v),
  },
  {
    id: 'rated',
    kind: 'fact',
    items: 'shows',
    defaultBlind: true,
    label: 'AniList score',
    prompt: 'Rank these shows from highest to lowest AniList score.',
    topLabel: 'HIGHEST',
    bottomLabel: 'LOWEST',
    valueFor: (show) => num(show?.averageScore),
    format: (v) => `${v}%`,
  },
  {
    id: 'popular',
    kind: 'fact',
    items: 'shows',
    defaultBlind: true,
    label: 'Popularity',
    prompt: 'Rank these shows from most to least popular on AniList.',
    topLabel: 'MOST',
    bottomLabel: 'LEAST',
    valueFor: (show) => num(show?.popularity),
    format: (v) => `${v.toLocaleString()} members`,
  },
  {
    id: 'length',
    kind: 'fact',
    items: 'shows',
    defaultBlind: true,
    label: 'Episode count',
    prompt: 'Rank these shows from longest to shortest.',
    topLabel: 'LONGEST',
    bottomLabel: 'SHORTEST',
    valueFor: (show) => num(show?.episodes),
    format: (v) => `${v} eps`,
  },

  // ---- facts: characters --------------------------------------------------
  {
    id: 'favourites',
    kind: 'fact',
    items: 'characters',
    defaultBlind: true,
    label: 'Character popularity',
    prompt: 'Rank these characters from most to least favourited on AniList.',
    topLabel: 'MOST',
    bottomLabel: 'LEAST',
    valueFor: (char) => num(char?.favourites),
    format: (v) => `${v.toLocaleString()} ♥`,
  },

  // ---- opinion ------------------------------------------------------------
  // `prompt` takes the subject's name because that is the whole game: you are
  // not ranking these, you are guessing how THEY would.
  {
    id: 'best',
    kind: 'opinion',
    items: 'shows',
    defaultBlind: false,
    label: 'Best → Worst',
    prompt: (name) => `Rank these shows best to worst, as ${name} would.`,
    topLabel: 'BEST',
    bottomLabel: 'WORST',
  },
  {
    id: 'overrated',
    kind: 'opinion',
    items: 'shows',
    defaultBlind: false,
    label: 'Underrated → Overrated',
    prompt: (name) => `Rank these from most underrated to most overrated, as ${name} would.`,
    topLabel: 'UNDERRATED',
    bottomLabel: 'OVERRATED',
  },
  {
    id: 'rewatch',
    kind: 'opinion',
    items: 'shows',
    defaultBlind: false,
    label: 'Rewatch forever → Drop it',
    prompt: (name) => `Rank these from "rewatch forever" to "drop by episode 3", as ${name} would.`,
    topLabel: 'FOREVER',
    bottomLabel: 'DROP IT',
  },
  {
    id: 'fight',
    kind: 'opinion',
    items: 'characters',
    defaultBlind: false,
    label: 'Would win → Would lose',
    prompt: (name) => `Rank these characters from would-win to would-lose in a fight, as ${name} would.`,
    topLabel: 'WOULD WIN',
    bottomLabel: 'WOULD LOSE',
  },
  {
    id: 'betray',
    kind: 'opinion',
    items: 'characters',
    defaultBlind: false,
    label: 'Traitor → Loyal',
    prompt: (name) => `Rank these characters from most likely to betray you to most loyal, as ${name} would.`,
    topLabel: 'TRAITOR',
    bottomLabel: 'LOYAL',
  },
  {
    id: 'roommate',
    kind: 'opinion',
    items: 'characters',
    defaultBlind: false,
    label: 'Best → Worst roommate',
    prompt: (name) => `Rank these characters from best to worst roommate, as ${name} would.`,
    topLabel: 'BEST',
    bottomLabel: 'WORST',
  },
];

export const DEFAULT_AXIS_ID = 'best';

const BY_ID = new Map(AXES.map((a) => [a.id, a]));

/**
 * Resolves whatever the round was handed into a full axis.
 *
 * The argument is an axis *spec*, and it is deliberately polymorphic: a string
 * id for one of the built-ins above, or a saved custom prompt — the plain
 * serializable object normalizeCustomPrompt produces. A custom prompt cannot be
 * looked up by id, because the only device that has ever seen its text is the
 * one it was written on; online, the definition itself has to travel in
 * `settings` for a guest to resolve it at all. Carrying both in one field is
 * what makes it impossible to ship an id whose definition got left behind.
 *
 * Never returns undefined: a spec can arrive from a saved room written by an
 * older build, and a round that cannot name its axis would render a blank board.
 */
export function getAxis(spec) {
  if (spec && typeof spec === 'object') {
    if (spec.custom) return customAxis(spec);       // a saved prompt, possibly straight off RTDB
    if (spec.kind && spec.items) return spec;       // already resolved — hand it straight back
    return getAxis(spec.id);                        // a bare { id } wrapper
  }
  return BY_ID.get(spec) ?? BY_ID.get(DEFAULT_AXIS_ID);
}

export function axesOfKind(kind) {
  return AXES.filter((a) => a.kind === kind);
}

export const isOpinion = (axis) => axis?.kind === 'opinion';
export const isCustom = (axis) => axis?.custom === true;

/**
 * The same kind of mode, in the other pool — the move behind AxisPicker's
 * Shows/Characters toggle.
 *
 * `items` used to be a hidden property of whichever axis happened to be picked,
 * discoverable only from a grey line under each mode name. That made half the
 * Opinion list irrelevant on any given screen: someone tiering their shows was
 * offered "Would win → Would lose". Making the pool a control means something
 * has to answer "you were on THIS mode, now you are in that pool — which mode
 * are you on?", and this is that answer.
 *
 * KIND IS PRESERVED, deliberately. Somebody on "Release date" who flips to
 * Characters is still asking a factual question; dropping them into an opinion
 * mode because it happened to be first in the list would be a different game.
 *
 * Returns a SPEC (an id string), not a resolved axis, because that is what
 * callers store and hand back to getAxis — see prefs.js's axisIdOf. Never
 * returns undefined, for the reason getAxis doesn't: a screen that cannot name
 * its axis renders a blank board.
 */
export function axisForPool(spec, items) {
  const current = getAxis(spec);
  const want = items === 'characters' ? 'characters' : 'shows';
  if (current.items === want) return spec;
  const match = AXES.find((a) => a.items === want && a.kind === current.kind)
    ?? AXES.find((a) => a.items === want);
  return match?.id ?? DEFAULT_AXIS_ID;
}

/**
 * Does this mode need its ends spelled out under its name?
 *
 * Expressed as kind/custom rather than by sniffing the label for an arrow,
 * because it IS a fact about those two groups rather than about the text: every
 * built-in opinion label is required to read top-to-bottom (see the AXES comment
 * above — "a mode called 'Worst → Best' above a board whose first slot is the
 * best is a contradiction"), so those labels already state their own direction
 * and printing "BEST → WORST" beneath "Best → Worst" is noise. A fact axis names
 * a dimension and a custom prompt names a clause; neither says which end is #1,
 * and both are drawn on the board's end caps verbatim.
 */
export const needsEndLabels = (axis) => axis?.kind === 'fact' || axis?.custom === true;

// The line above the board. Opinion prompts are functions of the subject's name;
// fact prompts are plain strings, so callers don't have to branch.
export function promptFor(axis, subjectName = 'they') {
  const { prompt } = getAxis(axis);
  return typeof prompt === 'function' ? prompt(subjectName) : prompt;
}

// Identity for a card. Shows are already collapsed to a franchise key by the
// deck builder; characters need name folding, because the same person appears
// under several season titles with different AniList ids.
export function itemKey(axis, item) {
  return getAxis(axis).items === 'characters'
    ? characterNameKey(item?.name)
    : item?.id;
}

// --- Custom prompts ---------------------------------------------------------
//
// A prompt a player wrote themselves. Stored as data and hydrated into a real
// axis on read, because a `prompt` function cannot survive JSON.stringify — and
// it has to, twice over: localStorage on the way back from a refresh, and
// Firebase on the way to every other device in the room.
//
// The stored shape is strings and one boolean:
//
//   { id, text, items, topLabel, bottomLabel, custom: true }
//
// No arrays, no nested objects, nothing empty — so none of CLAUDE.md's RTDB
// normalization traps apply to it.

export const MAX_PROMPT_LEN = 80;
export const MAX_END_LABEL_LEN = 12;

// The ends of the board when the player didn't name them. Generic on purpose:
// they read correctly for any "rank by how much X" prompt, which is the shape
// the framing below pushes people towards.
const DEFAULT_TOP = 'MOST';
const DEFAULT_BOTTOM = 'LEAST';

// The AniFake clue idiom (see anifake/rules.js submitClue): trim, collapse runs
// of whitespace, then truncate. Doing it here rather than in the editor means a
// prompt that arrives from storage — or from another device — is cleaned by the
// same rule as one being typed.
const clean = (text, max) => (text || '').trim().replace(/\s+/g, ' ').slice(0, max);

/**
 * Repairs a draft or a saved entry into the stored shape, or returns null if
 * there is nothing to save.
 *
 * Runs on every read as well as every write, the way normalizeProfile does, so
 * an entry saved by an older build is repaired without a migration flag. Null
 * for empty text is what lets the loader drop a junk entry instead of listing a
 * nameless prompt that renders a blank board.
 */
export function normalizeCustomPrompt(draft) {
  const text = clean(draft?.text, MAX_PROMPT_LEN);
  if (!text) return null;
  return {
    id: draft?.id || `custom_${Date.now().toString(36)}`,
    text,
    items: draft?.items === 'characters' ? 'characters' : 'shows',
    // Resolved here, never left blank, so nothing downstream has to default
    // them — and uppercased because the board renders these ends verbatim
    // beside built-in labels that are all caps.
    topLabel: clean(draft?.topLabel, MAX_END_LABEL_LEN).toUpperCase() || DEFAULT_TOP,
    bottomLabel: clean(draft?.bottomLabel, MAX_END_LABEL_LEN).toUpperCase() || DEFAULT_BOTTOM,
    custom: true,
  };
}

// The menu label. The player types a clause ("most likely to steal your food"),
// so it is capitalised for the list rather than stored capitalised — the prompt
// sentence needs it lowercase mid-line.
const sentenceCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Hydrates a saved prompt into the axis shape every screen reads.
 *
 * Always `kind: 'opinion'` and always without a `valueFor`: there is no number
 * on a card that answers "most likely to steal your food", so the subject's own
 * board is the only possible answer key. That also means `defaultBlind: false` —
 * dealt blind, the key would record the order the cards arrived in as much as
 * what the subject thinks (see the header).
 */
export function customAxis(saved) {
  const p = normalizeCustomPrompt(saved);
  // Only reachable from getAxis, which has already seen `custom: true` on
  // something with no usable text. Falling back beats rendering a blank board.
  if (!p) return BY_ID.get(DEFAULT_AXIS_ID);

  const noun = p.items === 'characters' ? 'characters' : 'shows';
  return {
    id: p.id,
    kind: 'opinion',
    items: p.items,
    defaultBlind: false,
    custom: true,
    // Kept on the resolved axis, not just consumed into the label, so a hydrated
    // axis is still a valid spec — getAxis can re-resolve it, which is what lets
    // callers pass either shape around without tracking which one they hold.
    text: p.text,
    label: sentenceCase(p.text),
    // The same "as THEY would" framing every built-in opinion prompt uses — the
    // player supplies only the clause, and the editor shows them this sentence
    // as they type so the framing is never a surprise mid-round.
    prompt: (name) => `Rank these ${noun} by ${p.text}, as ${name} would.`,
    topLabel: p.topLabel,
    bottomLabel: p.bottomLabel,
  };
}
