import AniTagGame from './AniTagGame';

export default {
  id: 'anitag',
  title: 'AniTag',
  // Says "no list needed" because it is unconditionally true here, unlike
  // AniWave's, which has to hedge: every answer in this game is judged by a
  // person, so nothing is ever drawn from anybody's anime list and no mode can
  // change that. A player arriving from the other five assumes the opposite, and
  // a hub card has one line to correct them with.
  // Describes the DEFAULT mode (chosen), not both — a hub card has one line and
  // spending it on "or, alternatively…" sells neither game. The dealt variant
  // is a setting away and its own screen explains it.
  blurb: 'Everyone picks a secret category. Name things until you work out somebody else’s. No list needed.',
  icon: '🏷️',
  accent: 'lime', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniTagGame,
};
