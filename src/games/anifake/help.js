import { MAX_DEALS } from './rules';

// The note under each setting, in the two tiers SettingHelp renders: `short` is
// always on screen, `more` only when the player asks for it.
//
// A module rather than two copies of the copy, for the reason
// components/AniTuneSettings.jsx was extracted: AniFakeSetup and OnlineLobby
// offer nearly the same options and used to hold the same paragraphs
// word-for-word, which is a promise nobody keeps. They had already drifted —
// the lobby's "shared characters" note had lost "and unfalsifiable for the
// fake", so the two screens were quietly explaining the setting differently.
//
// `fame` carries no `short`: that line is getFame(id).blurb and changes with the
// level, so the screens pass it in. Everything else is fixed text.
export const SETTING_HELP = {
  laps: {
    short: 'How many times round the table before the vote opens.',
    more: `More clues means more to go on — and more chances for the fake to trip over
           their own story.`,
  },

  sharedOnly: {
    short: 'Only use characters that every player has on their list.',
    more: `The whole table gives clues about one of them, so a character only one player
           has seen makes the round unplayable for the rest — and unfalsifiable for the
           fake.`,
  },

  fame: {
    more: `Sharing a show is not the same as remembering everyone in it — a background
           character nobody can describe makes every clue meaningless and the fake
           impossible to catch.`,
  },

  // The re-deal rules used to be stated in full here and nowhere else. Most of
  // them now live on the card-check screens themselves (components/CardCheck.jsx
  // and SecretReveal.jsx), which is where a table is actually deciding — this is
  // the host choosing whether to offer the phase at all.
  //
  // "Anonymously" survives into the short line on purpose: it is the single fact
  // that makes the setting safe to turn on, and a host who does not know it may
  // reasonably leave it off.
  allowRedeal: {
    short: 'Everyone looks at their card first, and anyone who draws a blank can '
      + 'anonymously ask for a new one.',
    more: `A round can be re-dealt at most ${MAX_DEALS - 1} times. A re-deal changes
           everyone's character, but not who the fake is — and in Blind the fake can't
           ask, since they hold no character to not-know.`,
  },

  talkMode: {
    short: 'Say your clue out loud instead of typing it, and tap to pass the turn on.',
    more: `Faster round the table — but nothing is written down, so there is no clue list
           to read back when it is time to vote.`,
  },
};
