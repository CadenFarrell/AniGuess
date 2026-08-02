import BlindRankGame from './BlindRankGame';

export default {
  id: 'blindrank',
  title: 'Blind Rank',
  blurb: 'Rank ten shows oldest to newest — one at a time, with no takebacks.',
  icon: '📊',
  accent: 'amber', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: BlindRankGame,
};
