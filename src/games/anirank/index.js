import AniRankGame from './AniRankGame';

export default {
  id: 'anirank',
  title: 'AniRank',
  blurb: 'Ten cards, one at a time, no takebacks. Rank them on facts — or on opinion.',
  icon: '📊',
  accent: 'amber', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniRankGame,
};
