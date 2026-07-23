import { useState } from 'react';

const DEFAULT_SETTINGS = {
  timerEnabled: false,
  timerSeconds: 60,
  pointsPerPosition: [3, 2, 1, 0],
  twoStepRandom: false,
};

export default function OnlineLobby({ room }) {
  const [sharedShowsOnly, setSharedShowsOnly] = useState(true);
  const players = room.gameSession?.players ?? [];

  const allHaveChars = players.every(
    (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0) > 0
  );
  const canStart = players.length >= 2 && allHaveChars;

  const handleStart = () => {
    room.handleStartGame({
      players,
      settings: { ...DEFAULT_SETTINGS, sharedShowsOnly },
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <h2 className="text-2xl font-black text-white mb-2">🌐 Room Lobby</h2>
        <p className="text-white/50 mb-1">Share this code with the other players:</p>
        <p className="text-5xl font-black text-white tracking-widest mb-8">{room.roomCode}</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-left">
          <h3 className="text-white/60 text-sm font-bold uppercase tracking-wider mb-3">
            Players ({players.length})
          </h3>
          {players.map((p) => {
            const chars = p.animeList.reduce((s, a) => s + a.characters.length, 0);
            return (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
                <span className="text-white">{p.name} {p.id === room.myPlayerId && <span className="text-purple-400">(you)</span>}</span>
                <span className={chars > 0 ? 'text-green-400 text-sm' : 'text-yellow-400 text-sm'}>
                  {chars > 0 ? `${chars} chars` : '⚠️ No chars'}
                </span>
              </div>
            );
          })}
          {players.length < 2 && <p className="text-white/40 text-sm mt-3">Waiting for more players to join…</p>}
        </div>

        <label className="flex items-center gap-3 text-white/80 text-lg mb-6 cursor-pointer">
          <input type="checkbox" checked={sharedShowsOnly} onChange={(e) => setSharedShowsOnly(e.target.checked)} className="w-5 h-5" />
          Shared shows only
        </label>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className="w-full py-5 rounded-xl font-black text-2xl transition-all
            disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed
            bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg"
        >
          🎮 Start Game
        </button>
      </div>
    </div>
  );
}
