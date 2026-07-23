import { useState } from 'react';
import { games } from './registry';
import { Backdrop, Badge, Screen, Wordmark } from '../shared/ui';

// Tile fill plus the border the card adopts on hover, so each game "lights up"
// in its own colour rather than every card sharing one highlight.
const ACCENTS = {
  pink: { tile: 'bg-pop-pink', hover: 'hover:border-pop-pink' },
  purple: { tile: 'bg-pop-purple', hover: 'hover:border-pop-purple' },
  lime: { tile: 'bg-pop-lime', hover: 'hover:border-pop-lime' },
  amber: { tile: 'bg-pop-amber', hover: 'hover:border-pop-amber' },
  blue: { tile: 'bg-pop-blue', hover: 'hover:border-pop-blue' },
};

// One game on the menu. Built on `btn-pop` directly rather than <Button> —
// it needs a two-line body and its own colour-tile layout, which the plain
// label-in-a-block Button API does not cover.
function GameCard({ game, onPick }) {
  const accent = ACCENTS[game.accent] ?? ACCENTS.pink;

  return (
    <button
      onClick={() => onPick(game.id)}
      disabled={!game.available}
      className={`btn-pop focus-pop group w-full flex items-center gap-4 p-4 text-left
        transition-colors bg-surface
        ${game.available ? 'border-white/15 ' + accent.hover : 'border-white/10'}`}
    >
      {/* Colour tile. Saturation is what marks a game as playable, so the
          unavailable one reads as "off" even without the badge. */}
      <span
        aria-hidden="true"
        className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-pop-sm border-2 border-ink
          text-3xl ${accent.tile} ${game.available ? '' : 'grayscale opacity-50'}`}
      >
        {game.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`font-display text-xl font-extrabold uppercase tracking-wide
              ${game.available ? 'text-white' : 'text-white/40'}`}
          >
            {game.title}
          </span>
          {!game.available && <Badge tone="amber">🔒 Soon</Badge>}
        </span>
        {/* btn-pop makes everything inside display-bold; the blurb is body copy
            and has to opt back out. */}
        <span
          className={`mt-1.5 block font-sans text-sm font-normal normal-case tracking-normal
            ${game.available ? 'text-white/55' : 'text-white/30'}`}
        >
          {game.blurb}
        </span>
      </span>

      {game.available && (
        <span
          aria-hidden="true"
          className="flex-shrink-0 pr-1 text-2xl text-white/30 transition-colors group-hover:text-white"
        >
          ▸
        </span>
      )}
    </button>
  );
}

// Top-level menu. Picks a game from the registry and hands it the whole screen;
// each game gets an onExit callback to come back here.
export default function HubScreen() {
  const [activeId, setActiveId] = useState(null);

  const active = games.find((g) => g.id === activeId);
  if (active) {
    const Game = active.Component;
    return <Game onExit={() => setActiveId(null)} />;
  }

  return (
    <>
      <Backdrop />
      <Screen center>
        <Wordmark subtitle="Pick a game" className="mb-10">
          Anime Hub
        </Wordmark>
        <div className="flex flex-col gap-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onPick={setActiveId} />
          ))}
        </div>
      </Screen>
    </>
  );
}
