// AniArcade's joystick, on its own sticker tile.
//
// This is public/favicon.svg brought into the app. The tab icon has been the
// only place the logo existed, which meant the hub — the one screen that is
// about the arcade rather than about a game — had no mark of its own.
//
// Colours are token classes rather than the favicon's hex literals: that file
// has to spell them out because a file in public/ cannot see the theme, and
// this one has no such excuse.
//
// Tilted the opposite way to Wordmark's default -2deg. Wordmark.jsx keeps its
// rotation as an inline style precisely so sibling stickers can lean against
// each other without minting a class per angle.
export default function ArcadeMark({ className = '' }) {
  return (
    <div
      style={{ transform: 'rotate(3deg)' }}
      className={`grid h-16 w-28 place-items-center rounded-pop border-2 border-ink
        bg-pop-pink shadow-pop ${className}`}
    >
      {/* A wide plaque rather than a square one, and that is the whole trick.
          A joystick alone is a person — the exact glyph the profile pill in the
          opposite corner wears — so it needs the buttons beside it to become a
          control panel. But squeezed into 64px square, a white ball and two
          white dots collapse into a FACE. Width is free here (the board below is
          max-w-4xl) while height is not, so the plaque spends width to give the
          three shapes room and costs the layout nothing.

          The buttons sit on a diagonal, as they do on a real cabinet, which is
          also what stops a symmetrical pair reading as eyes. */}
      <svg viewBox="0 0 84 48" aria-hidden="true" className="h-10">
        {/* Base, then shaft, then ball, so each caps the one below — the order
            favicon.svg draws them in. */}
        <ellipse className="fill-ink" cx="24" cy="37" rx="16" ry="4.5" />
        <rect
          className="fill-ink"
          x="21" y="17" width="6" height="20"
          transform="rotate(-18 24 37)"
        />
        <circle
          className="fill-white stroke-ink"
          cx="24" cy="16" r="7" strokeWidth="3"
          transform="rotate(-18 24 37)"
        />
        <circle className="fill-white stroke-ink" cx="58" cy="19" r="6.5" strokeWidth="3" />
        <circle className="fill-white stroke-ink" cx="71" cy="33" r="6.5" strokeWidth="3" />
      </svg>
    </div>
  );
}
