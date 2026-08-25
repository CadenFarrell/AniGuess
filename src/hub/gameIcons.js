// The hub's game icons, as data rather than JSX.
//
// Geometry lives here and not in GameIcon.jsx for the reason
// games/wavelength/utils/arc.js states about its own maths: the vitest config
// only runs src/**/*.test.js under environment: 'node', so anything defined in
// a .jsx file is untestable by construction. A mistyped key here fails
// SILENTLY — the tile just keeps rendering its emoji forever — which is exactly
// the class of bug a test should catch and an eyeball never will.
//
// The visual language is public/favicon.svg's, which is the one piece of
// AniArcade art that already existed and which nothing in the app had ever put
// on screen: a chunky ink silhouette on the tile's accent fill, with white as
// the single highlight. Ink-on-accent also survives the unavailable card's
// `grayscale opacity-50` for free, and it still reads at ~120px, which is the
// real constraint — a phone tile's marquee is about 165x124.
//
// Paint goes in `className` so the icons use the @theme tokens (and so a colour
// can never drift from index.css); geometry and stroke shape go in attributes.
// That split is Dial.jsx's. No hex literals and no currentColor — the codebase
// uses neither in JSX. favicon.svg is the one place hex appears, because a file
// in public/ cannot see the theme.

// Square, matching favicon.svg. The marquee is 4:3, so the caller sizes by
// height and lets the width derive itself.
export const VIEWBOX = '0 0 48 48';

// Only these are rendered. Keeping the list short and explicit means a typo in
// `tag` is a test failure rather than a React warning nobody reads.
export const ICON_TAGS = ['rect', 'circle', 'ellipse', 'path', 'line'];

export const GAME_ICONS = {
  // A card held up face-out with a bold "?" — you are holding a character you
  // cannot see, which is the whole game.
  aniguess: [
    { tag: 'rect', className: 'fill-white stroke-ink', x: 12, y: 7, width: 24, height: 34, rx: 4, strokeWidth: 3 },
    {
      tag: 'path',
      className: 'fill-none stroke-ink',
      d: 'M18.5 18a5.5 5.5 0 1 1 5.5 6v2.5',
      strokeWidth: 3.2,
      strokeLinecap: 'round',
    },
    { tag: 'circle', className: 'fill-ink', cx: 24, cy: 33, r: 2.4 },
  ],

  // Beamed eighth notes with the sound coming off them. The arcs are the white
  // here rather than the notes: a solid ink note is the stronger silhouette.
  anitune: [
    { tag: 'ellipse', className: 'fill-ink', cx: 13, cy: 35, rx: 6, ry: 5 },
    { tag: 'ellipse', className: 'fill-ink', cx: 26, cy: 32, rx: 6, ry: 5 },
    { tag: 'rect', className: 'fill-ink', x: 15.5, y: 13, width: 3.5, height: 22 },
    { tag: 'rect', className: 'fill-ink', x: 28.5, y: 10, width: 3.5, height: 22 },
    { tag: 'path', className: 'fill-ink', d: 'M15.5 13 L32 9.5 L32 15.5 L15.5 19 Z' },
    {
      tag: 'path',
      className: 'fill-none stroke-white',
      d: 'M37.5 19a7 7 0 0 1 0 10',
      strokeWidth: 3,
      strokeLinecap: 'round',
    },
    {
      tag: 'path',
      className: 'fill-none stroke-white',
      d: 'M41.5 15.5a11.5 11.5 0 0 1 0 17',
      strokeWidth: 3,
      strokeLinecap: 'round',
    },
  ],

  // A ranked list, widest first. The white row is the TOP one on purpose: the
  // board runs top-down and slot 1 is the MOST of whatever the axis measures,
  // so highlighting the bottom would illustrate the opposite of the game.
  anirank: [
    { tag: 'rect', className: 'fill-white stroke-ink', x: 8, y: 9, width: 32, height: 9, rx: 3, strokeWidth: 3 },
    { tag: 'rect', className: 'fill-ink', x: 8, y: 21.5, width: 24, height: 9, rx: 3 },
    { tag: 'rect', className: 'fill-ink', x: 8, y: 34, width: 16, height: 9, rx: 3 },
  ],

  // Three cards side by side, the middle one raised and blank — everybody is
  // holding the same character except one, and the odd one out is holding
  // nothing.
  //
  // Deliberately NOT fanned. Overlapping them reads as a single card with dark
  // smudges either side at tile size, which is the one thing this icon must not
  // say: the whole game is that there are three of something and one differs.
  // Separation beats depth here.
  anifake: [
    { tag: 'rect', className: 'fill-ink', x: 3, y: 15, width: 13, height: 22, rx: 3 },
    { tag: 'rect', className: 'fill-ink', x: 32, y: 15, width: 13, height: 22, rx: 3 },
    { tag: 'rect', className: 'fill-white stroke-ink', x: 17.5, y: 10, width: 13, height: 27, rx: 3, strokeWidth: 3 },
  ],

  // The dial: an ink band, the white target sitting somewhere on it, and a
  // needle that is not pointing at it. The needle is deliberately away from the
  // target — the round is spent trying to close that gap.
  //
  // The paths are hardcoded rather than computed from
  // games/wavelength/utils/arc.js. The hub should not reach into a game's
  // internals, and a static shape has no maths to get wrong, which serves that
  // file's own "angle maths fails silently" rule better than importing it would.
  // It is the same annular sector wedgePath() emits, centred (24,34), r 10..19.
  aniwave: [
    { tag: 'path', className: 'fill-ink', d: 'M5 34 A19 19 0 0 1 43 34 L34 34 A10 10 0 0 0 14 34 Z' },
    {
      tag: 'path',
      className: 'fill-white',
      d: 'M20.7 15.29 A19 19 0 0 0 11.79 19.45 L17.57 26.34 A10 10 0 0 1 22.26 24.15 Z',
    },
    {
      tag: 'line',
      className: 'stroke-white',
      x1: 24, y1: 34, x2: 33.75, y2: 20.07,
      strokeWidth: 3.5,
      strokeLinecap: 'round',
    },
    // Drawn last so it caps the needle's base.
    { tag: 'circle', className: 'fill-ink', cx: 24, cy: 34, r: 4.5 },
  ],

  // A tag with a "?" on it — everyone is carrying one and nobody can read
  // their own.
  anitag: [
    {
      tag: 'path',
      className: 'fill-ink',
      d: 'M24 4 L39 13 V40 a3 3 0 0 1-3 3 H12 a3 3 0 0 1-3-3 V13 Z',
    },
    { tag: 'circle', className: 'fill-white', cx: 24, cy: 12.5, r: 2.6 },
    {
      tag: 'path',
      className: 'fill-none stroke-white',
      d: 'M20.5 25a3.5 3.5 0 1 1 3.5 4v1',
      strokeWidth: 3,
      strokeLinecap: 'round',
    },
    { tag: 'circle', className: 'fill-white', cx: 24, cy: 34.5, r: 2.2 },
  ],
};
