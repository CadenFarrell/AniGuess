export default function RoundEnd({ players, lockedPositions, roundNumber, totalScores, onNewRound, onEndSession }) {
  const getPositionEmoji = (pos) => ['🥇', '🥈', '🥉'][pos - 1] || `#${pos}`;

  const ranked = [...players]
    .map((p) => ({ ...p, total: totalScores[p.id] || 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <h2 className="text-5xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mb-3">
          🏁 Round {roundNumber} Done!
        </h2>

        {/* This Round */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-5">
          <h3 className="text-white font-bold text-xl mb-4">This Round</h3>
          {lockedPositions
            .sort((a, b) => a.position - b.position)
            .map((lp) => {
              const isTied = lockedPositions.filter(
                (other) => other.turnsUsed === lp.turnsUsed
              ).length > 1;
              return (
                <div key={lp.playerId} className="flex justify-between items-center py-3 border-b border-white/10 last:border-0">
                  <span className="text-white text-lg">
                    {getPositionEmoji(lp.position)} {lp.name}
                    {isTied && <span className="text-yellow-400 text-sm ml-2">🤝 Tied</span>}
                  </span>
                  <div className="text-right">
                    <span className="text-green-400 font-bold text-lg">+{lp.points} pts</span>
                    <span className="text-white/40 text-sm ml-3">({lp.turnsUsed} turns)</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Total Scores */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h3 className="text-white font-bold text-xl mb-4">Total Scores</h3>
          {ranked.map((p) => {
            const isLeading = p.total > 0 && p.total === ranked[0].total;
            return (
              <div key={p.id} className="flex justify-between items-center py-3 border-b border-white/10 last:border-0">
                <span className="text-white text-lg">{isLeading ? '👑 ' : ''}{p.name}</span>
                <span className="text-purple-400 font-black text-xl">{p.total} pts</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={onNewRound}
            className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-2xl rounded-xl transition-all"
          >
            🔄 New Round
          </button>
          <button
            onClick={onEndSession}
            className="w-full py-5 bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-500 hover:to-red-500 text-white font-black text-2xl rounded-xl transition-all"
          >
            🏆 End & See Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
