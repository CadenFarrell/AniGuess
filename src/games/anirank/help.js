// The note under each setting, in the two tiers SettingHelp renders: `short` is
// always on screen, `more` only when the player asks for it.
//
// Shared by AniRankSetup and OnlineLobby for the reason anifake/help.js gives —
// they held the same paragraphs by convention and it does not hold.
//
// `sharedOnly` is a function because its wording depends on two things the
// screen knows and this module cannot: which pool is selected (`shows` or
// `characters`, from the axis) and whether the format is a tier list. Those are
// not cosmetic variants — a tier list has no board and no answer key, so the
// reason to share a pool is completely different.

export const sharedOnlyHelp = ({ noun, tiering }) => ({
  short: `Only use ${noun} that every player has on their list.`,
  more: tiering
    ? `Two lists then come from the same pool, which is what makes them comparable —
       otherwise half of each list is something the other person never rated.`
    : `Everyone ranks the same ten, so a card only one player knows is a free guess for
       the rest.`,
});

export const SETTING_HELP = {
  blind: {
    short: 'Cards arrive one at a time and can’t be moved once placed.',
    more: 'Turn it off to see all ten at once and arrange them freely before locking in.',
  },

  scoring: {
    short: 'On, your board is measured against an answer key.',
    more: `Turn it off to just build boards and compare them at the end — no answer key, no
           points, nothing to win.`,
  },
};
