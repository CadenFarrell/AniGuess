// The two ways AniFake deals. The difference is entirely in what the fake is
// told — every phase after the deal is identical, except that decoy mode has
// nothing for a caught fake to steal.
//
// The hint word is blind-mode only, and deliberately so: in decoy mode the fake
// holds a character of their own and must not be able to tell that anything
// about their card differs from everyone else's. See rules.dealRoles.
//
// Adding a mode means adding an entry here plus a branch in rules.dealRoles;
// the screens read their labels off the mode rather than hardcoding them.

export const MODES = [
  {
    id: 'blind',
    label: 'Blind',
    blurb: 'One player is told they’re the fake and given a single word to bluff from.',
    // What the fake's own card says on screen, and what they publish at the
    // reveal — see rules.deriveTruth.
    confesses: true,
    steal: true,
  },
  {
    id: 'decoy',
    label: 'Decoy',
    blurb: 'The fake is handed a different character and is never told. Nobody knows who they are — including them.',
    confesses: false,
    steal: false,
  },
];

export const DEFAULT_MODE_ID = 'blind';

const BY_ID = new Map(MODES.map((m) => [m.id, m]));

// Never returns undefined: a mode id can arrive from a saved room written by an
// older build, and a round that cannot name its mode would render a blank card.
export function getMode(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_MODE_ID);
}
