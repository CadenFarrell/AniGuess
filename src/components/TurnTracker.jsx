export default function TurnTracker({ players, currentPlayerId, lockedPositions }) {
  const getPositionEmoji = (pos) => ['🥇', '🥈', '🥉'][pos - 1] || `#${pos}`;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex gap-3 flex-wrap">
        {players.map((player) => {
          const locked = lockedPositions.find((lp) => lp.playerId === player.id);
          const isCurrent = player.id === currentPlayerId;
          const isTied = locked && lockedPositions.filter(
            (lp) => lp.turnsUsed === locked.turnsUsed
          ).length > 1;

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold transition-all
                ${isCurrent ? 'bg-purple-600 text-white' : locked ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/40'}`}
            >
              <span>{player.name}</span>
              <span>
                {locked
                  ? `${getPositionEmoji(locked.position)}${isTied ? '🤝' : ''}`
                  : isCurrent ? '🎮' : '⏳'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
