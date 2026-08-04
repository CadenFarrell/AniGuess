import AniRankGame from './AniRankGame';

export default {
  id: 'anirank',
  title: 'AniRank',
  // Deliberately does not promise "one at a time": that is true of the fact
  // modes and of any round the host sets to blind, but the opinion modes now
  // deal all ten at once by default.
  blurb: 'Ten cards, one board. Rank them on facts — or on how someone else would.',
  icon: '📊',
  accent: 'amber', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniRankGame,
};
