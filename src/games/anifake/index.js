import AniFakeGame from './AniFakeGame';

export default {
  id: 'anifake',
  title: 'AniFake',
  blurb: 'Everyone knows the character. One of you is faking it — find the fake.',
  icon: '🕵️',
  accent: 'teal', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: AniFakeGame,
};
