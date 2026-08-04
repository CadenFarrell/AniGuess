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

// Never returns undefined: an axis id can arrive from a saved room written by an
// older build, and a round that cannot name its axis would render a blank board.
export function getAxis(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_AXIS_ID);
}

export function axesOfKind(kind) {
  return AXES.filter((a) => a.kind === kind);
}

export const isOpinion = (axis) => axis?.kind === 'opinion';

// The line above the board. Opinion prompts are functions of the subject's name;
// fact prompts are plain strings, so callers don't have to branch.
export function promptFor(axis, subjectName = 'they') {
  const { prompt } = getAxis(axis?.id ?? axis);
  return typeof prompt === 'function' ? prompt(subjectName) : prompt;
}

// Identity for a card. Shows are already collapsed to a franchise key by the
// deck builder; characters need name folding, because the same person appears
// under several season titles with different AniList ids.
export function itemKey(axis, item) {
  return getAxis(axis?.id ?? axis).items === 'characters'
    ? characterNameKey(item?.name)
    : item?.id;
}
