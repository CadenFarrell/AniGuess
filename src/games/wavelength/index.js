import WavelengthGame from './WavelengthGame';

export default {
  id: 'aniwave',
  title: 'AniWave',
  // Still says "no list needed", and it is still true of the mode this opens in:
  // two of the three clue modes deal cards now, but `clueMode` defaults to the
  // typed clue, so anybody can play this before importing anything — and a player
  // arriving from the other four will assume the opposite. The setup screen is
  // where the two card modes announce what they need; a hub card has one line,
  // and it should describe what happens if you press it.
  blurb: 'One of you knows where the target is. Say the right words. No list needed.',
  icon: '📡',
  accent: 'purple', // drives the hub card's colour — see src/shared/ui/Badge.jsx tones
  available: true,
  Component: WavelengthGame,
};
