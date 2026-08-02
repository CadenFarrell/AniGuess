import aniguess from '../games/aniguess';
import anitune from '../games/anitune';
import blindrank from '../games/blindrank';

// The hub renders this list and nothing else — adding a game means adding a
// folder under src/games/ and one line here. Keep the order stable; it is the
// order players see on the menu.
export const games = [aniguess, anitune, blindrank];
