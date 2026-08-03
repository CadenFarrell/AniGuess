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

export const AXES = [
  // ---- facts: shows -------------------------------------------------------
  {
    id: 'year',
    kind: 'fact',
    items: 'shows',
    label: 'Release date',
    prompt: 'Rank these shows from oldest to newest.',
    lowLabel: 'OLDEST',
    highLabel: 'NEWEST',
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
    label: 'AniList score',
    prompt: 'Rank these shows from lowest to highest AniList score.',
    lowLabel: 'LOWEST',
    highLabel: 'HIGHEST',
    valueFor: (show) => num(show?.averageScore),
    format: (v) => `${v}%`,
  },
  {
    id: 'popular',
    kind: 'fact',
    items: 'shows',
    label: 'Popularity',
    prompt: 'Rank these shows from least to most popular on AniList.',
    lowLabel: 'LEAST',
    highLabel: 'MOST',
    valueFor: (show) => num(show?.popularity),
    format: (v) => `${v.toLocaleString()} members`,
  },
  {
    id: 'length',
    kind: 'fact',
    items: 'shows',
    label: 'Episode count',
    prompt: 'Rank these shows from shortest to longest.',
    lowLabel: 'SHORTEST',
    highLabel: 'LONGEST',
    valueFor: (show) => num(show?.episodes),
    format: (v) => `${v} eps`,
  },

  // ---- facts: characters --------------------------------------------------
  {
    id: 'favourites',
    kind: 'fact',
    items: 'characters',
    label: 'Character popularity',
    prompt: 'Rank these characters from least to most favourited on AniList.',
    lowLabel: 'LEAST',
    highLabel: 'MOST',
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
    label: 'Worst → Best',
    prompt: (name) => `Rank these shows worst to best, as ${name} would.`,
    lowLabel: 'WORST',
    highLabel: 'BEST',
  },
  {
    id: 'overrated',
    kind: 'opinion',
    items: 'shows',
    label: 'Overrated → Underrated',
    prompt: (name) => `Rank these from most overrated to most underrated, as ${name} would.`,
    lowLabel: 'OVERRATED',
    highLabel: 'UNDERRATED',
  },
  {
    id: 'rewatch',
    kind: 'opinion',
    items: 'shows',
    label: 'Drop it → Rewatch forever',
    prompt: (name) => `Rank these from "drop by episode 3" to "rewatch forever", as ${name} would.`,
    lowLabel: 'DROP IT',
    highLabel: 'FOREVER',
  },
  {
    id: 'fight',
    kind: 'opinion',
    items: 'characters',
    label: 'Would lose → Would win',
    prompt: (name) => `Rank these characters from would-lose to would-win in a fight, as ${name} would.`,
    lowLabel: 'WOULD LOSE',
    highLabel: 'WOULD WIN',
  },
  {
    id: 'betray',
    kind: 'opinion',
    items: 'characters',
    label: 'Loyal → Would betray you',
    prompt: (name) => `Rank these characters from most loyal to most likely to betray you, as ${name} would.`,
    lowLabel: 'LOYAL',
    highLabel: 'TRAITOR',
  },
  {
    id: 'roommate',
    kind: 'opinion',
    items: 'characters',
    label: 'Worst → Best roommate',
    prompt: (name) => `Rank these characters from worst to best roommate, as ${name} would.`,
    lowLabel: 'WORST',
    highLabel: 'BEST',
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
