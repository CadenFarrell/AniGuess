import AniTuneGame from './AniTuneGame';

export default {
  id: 'anitune',
  title: 'AniTune',
  blurb: 'Guess the anime from the sound of its opening or ending.',
  icon: '🎵',
  accent: 'blue', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniTuneGame,
};
