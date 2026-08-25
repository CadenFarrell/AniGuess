import { MIN_CARD_POOL } from './utils/cards';

// The note under each setting, in the two tiers SettingHelp renders: `short` is
// always on screen, `more` only when the player asks for it.
//
// One module rather than two copies of the copy, for the reason anifake/help.js
// gives: WavelengthSetup and OnlineLobby offer overlapping options, and two
// screens holding the same paragraph by convention is a promise nobody keeps.
//
// `sharedOnly` is a function because its wording depends on which pool is
// selected, and `clueMode` carries a blurb per mode rather than one paragraph —
// the three modes are three different games, and a single note describing all of
// them is what a settings screen looks like when nobody wanted to choose.

export const CLUE_MODE_HELP = {
  text: {
    label: 'Typed clue',
    tag: 'No list needed',
    short: 'The psychic types a word or a phrase pointing at the hidden target.',
    more: `Nothing is drawn from anyone's anime list, so this is the one mode a table can
           play the moment they open the app.`,
  },
  cards: {
    label: 'Clue cards',
    tag: 'Needs a list',
    short: 'The psychic searches the shared list and plays the card closest to the target.',
    more: `Everyone else sees only the one they played — every other card they looked at
           stays on their device. The target is still hidden and still random.`,
  },
  readroom: {
    label: 'Read the room',
    tag: 'Needs a list',
    short: 'Everyone sees one card. Guess where the psychic put it.',
    more: `There is no hidden target and no clue: the psychic's own answer IS the answer
           key, so the round is about how well the table knows them.`,
  },
};

export const sharedOnlyHelp = ({ noun }) => ({
  short: `Only use ${noun} that every player has on their list.`,
  more: `The whole table places the same card, so one only the psychic has seen is a free
         guess for everyone else — and in “Read the room” it is worse, since they are
         being asked what the psychic thinks about something they cannot picture. In
         “Clue cards” it is the only thing standing between the table and a psychic who
         searches up something nobody else has watched.`,
});

export const SETTING_HELP = {
  rounds: {
    short: 'Everyone takes a turn as the psychic.',
    more: 'A session divides most evenly when this is a multiple of the number of players.',
  },

  cardPool: {
    short: 'Which pool the cards come from — and which spectrums get suggested.',
    // Also decides what the psychic's search box is searching in "Clue cards",
    // and which spectrums SpectrumPicker offers: half of them only make sense
    // about one pool, and that is not inferable from a control labelled "Cards".
    more: `Characters are the sharper prompt — a person sits somewhere on almost any
           spectrum — while shows give a table more to argue about. The psychic is
           only offered spectrums that fit whichever you pick.`,
  },

  timed: {
    short: 'The round reveals when the clock runs out, scoring whatever dials are in.',
    more: `Anyone who never placed one scores nothing — and is left out of the psychic's
           average rather than dragging it down.`,
  },
};

// Said when the pool is too small to deal from, and it branches on the CAUSE
// rather than printing one line: with a short shared list this is the ordinary
// outcome, not an edge case, and the two remedies are opposite actions.
export const poolTooSmall = ({ eligible, noun, sharedOnly, players }) => (
  `Only ${eligible} ${noun} to draw from — this mode needs ${MIN_CARD_POOL}.${
    sharedOnly && players > 1
      ? ' Turn off “Shared cards only”, or import more lists.'
      : ' Import a bigger list with the 🔗 button, or switch to a typed clue.'
  }`
);
