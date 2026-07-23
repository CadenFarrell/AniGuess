import { getPositionEmoji } from '../../../shared/utils/ranking';

export default function TurnTracker({ players, currentPlayerId, lockedPositions }) {
  return (
    <div className="card-pop mb-6 p-4">
      <div className="flex flex-wrap gap-3">
        {players.map((player) => {
          const locked = lockedPositions.find((lp) => lp.playerId === player.id);
          const isCurrent = player.id === currentPlayerId;
          const isTied = locked && lockedPositions.filter(
            (lp) => lp.turnsUsed === locked.turnsUsed
          ).length > 1;

          // Whose turn it is is the one thing this strip has to communicate at
          // a glance, so only that chip gets a saturated fill.
          const tone = isCurrent
            ? 'bg-pop-purple text-ink border-ink'
            : locked
              ? 'bg-surface-2 text-white/60 border-white/15'
              : 'bg-surface text-white/40 border-white/10';

          return (
            <div
              key={player.id}
              className={`flex items-center gap-2 rounded-pop-sm border-2 px-4 py-2
                font-display text-base font-extrabold ${tone}`}
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
