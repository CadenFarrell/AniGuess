import AniGuessGame from './AniGuessGame';

export default {
  id: 'aniguess',
  title: 'AniGuess',
  blurb: 'Guess the anime character you were assigned by asking yes/no questions.',
  icon: '🎭',
  accent: 'pink', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniGuessGame,
};
