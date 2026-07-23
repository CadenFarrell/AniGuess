import { useMemo } from 'react';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import { Button, Card, CardRow, Screen, Wordmark } from '../../../shared/ui';

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

  // Gold / silver / bronze. The palette has no brown, so bronze is a knocked-
  // back amber — still clearly a step below gold.
  const podiumConfig = {
    1: { height: 'h-44', color: 'bg-pop-amber', emoji: '🥇' },
    2: { height: 'h-28', color: 'bg-white/70', emoji: '🥈' },
    3: { height: 'h-20', color: 'bg-pop-amber/50', emoji: '🥉' },
  };

  return (
    <Screen center width="md" className="text-center">
      <Wordmark tone="amber" size="md" level={2} className="mb-3">
        🏆 Final Results
      </Wordmark>
      <p className="mb-10 text-lg text-white/50">
        {roundNumber} round{roundNumber !== 1 ? 's' : ''} played
      </p>

      {/* Podium */}
      {withPositions.length >= 2 && (
        <div className="mb-10 flex items-end justify-center gap-4">
          {podiumSlots.map((slot) => {
            const { height, color, emoji } = podiumConfig[slot.pos];
            return (
              <div key={slot.pos} className="flex items-end gap-2">
                {slot.players.map((player) => (
                  <div key={player.id} className="flex flex-col items-center">
                    <span className="mb-2 text-3xl">{emoji}</span>
                    <p className="mb-1 font-display text-base font-extrabold text-white">
                      {player.name}
                    </p>
                    <p className="mb-1 text-sm text-white/70">{player.total} pts</p>
                    {isTied(player) && <p className="mb-1 text-xs text-pop-amber">🤝</p>}
                    {/* Blocks, not bars — same ink border as every other solid
                        fill. No bottom border so they sit on the baseline. */}
                    <div
                      className={`${height} ${color} w-24 rounded-t-pop-sm border-2 border-b-0 border-ink sm:w-28`}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Rankings */}
      <Card padding="lg" className="mb-8 text-left">
        {withPositions.map((player) => (
          <CardRow
            key={player.id}
            className={player.position === 1 ? 'text-pop-amber' : 'text-white'}
          >
            <span className="font-display text-lg font-extrabold">
              {getPositionEmoji(player.position)} {player.name}
              {isTied(player) && <span className="ml-2 text-sm text-pop-amber">🤝 Tied</span>}
            </span>
            <span className="font-display text-2xl font-extrabold">{player.total} pts</span>
          </CardRow>
        ))}
      </Card>

      <div className="flex flex-col gap-4">
        <Button variant="primary" size="xl" fullWidth onClick={onPlayAgain}>
          🎮 Play Again
        </Button>
        <Button variant="neutral" size="lg" fullWidth onClick={onEditLists}>
          ✏️ Edit Character Lists
        </Button>
      </div>
    </Screen>
  );
}
