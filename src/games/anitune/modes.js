import { RACE, SIMULTANEOUS, LIVES } from './rules';

// The mode picker's table. Same shape as anifake/fame.js and anirank's axes: a
// labelled list plus a resolver that never returns undefined, because an id can
// arrive from a saved prefs blob or a room written by an older build and a
// screen that cannot name its own mode renders a blank card.
export const MODES = [
  {
    id: RACE,
    icon: '🔔',
    label: 'Race',
    blurb: 'First correct answer takes the point. Miss and you’re out for that song.',
  },
  {
    id: SIMULTANEOUS,
    icon: '🤫',
    label: 'Everyone guesses',
    blurb: 'Everyone answers the same clip. Everyone who gets it right scores.',
  },
  {
    id: LIVES,
    icon: '💀',
    label: 'Last one standing',
    blurb: 'Everyone answers, and a miss costs a life. Outlast the table.',
  },
];

const BY_ID = new Map(MODES.map((m) => [m.id, m]));

export function getMode(id) {
  return BY_ID.get(id) ?? BY_ID.get(RACE);
}
