import { useState } from 'react';
import { games } from './registry';

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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-3">
          Anime Hub
        </h1>
        <p className="text-white/60 text-lg mb-10">Pick a game</p>
        <div className="flex flex-col gap-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => game.available && setActiveId(game.id)}
              disabled={!game.available}
              title={game.available ? '' : 'Coming soon'}
              className="w-full px-6 py-5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors text-left"
            >
              <span className="block font-black text-xl">
                {game.icon} {game.title} {!game.available && '(coming soon)'}
              </span>
              <span className="block text-white/50 text-sm mt-1">{game.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
