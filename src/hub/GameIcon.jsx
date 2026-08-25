import { createElement } from 'react';
import { GAME_ICONS, VIEWBOX } from './gameIcons';

// Renders one game's icon from the shape data in gameIcons.js.
//
// Returns null for a game nobody has drawn yet so the caller can fall back to
// its emoji — a new game gets a working tile the day it lands rather than an
// empty panel, and drawing it later is one entry in gameIcons.js.
//
// aria-hidden because it is decoration: the accessible name is the title text
// in the button beside it, exactly as with the emoji this replaces and as
// Dial.jsx does with the arc it draws.
//
// Sets no size of its own. AniRankResults.jsx's Tangle explains why — two
// Tailwind classes setting the same property are resolved by stylesheet order,
// not call order, so a base width class here would silently fight the one
// passed in. An <svg> with a viewBox and a CSS height derives its own width,
// so a height class from the caller is enough.
export default function GameIcon({ id, className = '' }) {
  const shapes = GAME_ICONS[id];
  if (!shapes) return null;

  return (
    <svg viewBox={VIEWBOX} aria-hidden="true" className={className}>
      {shapes.map(({ tag, ...attrs }, i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
