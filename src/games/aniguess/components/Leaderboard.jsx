import { useMemo } from 'react';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';

export default function Leaderboard({ players, totalScores, roundNumber, onPlayAgain, onEditLists }) {
  const withPositions = useMemo(
    () => computeRankedPlayers(players, totalScores),
    [players, totalScores]
  );

  const isTied = (player) =>
    withPositions.filter((p) => p.position === player.position).length > 1;

  // Group players by podium position (2nd, 1st, 3rd) — all tied players share the same slot
  const podiumSlots = [2, 1, 3].map((pos) => ({
    pos,
    players: withPositions.filter((p) => p.position === pos),
  })).filter((slot) => slot.players.length > 0);

  const podiumConfig = {
    1: { height: 'h-44', color: 'bg-yellow-400', emoji: '🥇' },
    2: { height: 'h-28', color: 'bg-gray-400',   emoji: '🥈' },
    3: { height: 'h-20', color: 'bg-amber-600',  emoji: '🥉' },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-5xl font-black mb-2">
          🏆 <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">Final Results</span>
        </h2>
        <p className="text-white/50 text-lg mb-10">{roundNumber} round{roundNumber !== 1 ? 's' : ''} played</p>

        {/* Podium */}
        {withPositions.length >= 2 && (
          <div className="flex items-end justify-center gap-4 mb-10">
            {podiumSlots.map((slot) => {
              const { height, color, emoji } = podiumConfig[slot.pos];
              return (
                <div key={slot.pos} className="flex items-end gap-2">
                  {slot.players.map((player) => (
                    <div key={player.id} className="flex flex-col items-center">
                      <span className="text-3xl mb-2">{emoji}</span>
                      <p className="text-white font-bold text-base mb-1">{player.name}</p>
                      <p className="text-white/70 text-sm mb-1">{player.total} pts</p>
                      {isTied(player) && <p className="text-yellow-400 text-xs mb-1">🤝</p>}
                      <div className={`${height} ${color} w-28 rounded-t-lg`} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Full Rankings */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left">
          {withPositions.map((player) => (
            <div
              key={player.id}
              className={`flex justify-between items-center py-4 border-b border-white/10 last:border-0
                ${player.position === 1 ? 'text-yellow-400' : 'text-white'}`}
            >
              <span className="font-bold text-lg">
                {getPositionEmoji(player.position)} {player.name}
                {isTied(player) && <span className="text-yellow-400 text-sm ml-2">🤝 Tied</span>}
              </span>
              <span className="font-black text-2xl">{player.total} pts</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onPlayAgain}
            className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-2xl rounded-xl transition-all"
          >
            🎮 Play Again
          </button>
          <button
            onClick={onEditLists}
            className="w-full py-5 bg-white/10 hover:bg-white/20 text-white font-bold text-xl rounded-xl transition-colors"
          >
            ✏️ Edit Character Lists
          </button>
        </div>
      </div>
    </div>
  );
}
