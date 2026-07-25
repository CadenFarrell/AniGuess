import { useMemo } from 'react';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import { Button, Card, CardRow, Screen, Wordmark } from '../../../shared/ui';

export default function RoundEnd({
  players, lockedPositions, roundNumber, totalScores, departedIds = [], onNewRound, onEndSession,
}) {
  const ranked = useMemo(
    () => computeRankedPlayers(players, totalScores),
    [players, totalScores]
  );

  // Don't mutate the prop — .sort() is in-place, and lockedPositions comes
  // straight from game state.
  const byPosition = useMemo(
    () => [...lockedPositions].sort((a, b) => a.position - b.position),
    [lockedPositions]
  );

  return (
    <Screen center width="md">
      <Wordmark tone="pink" size="md" level={2} className="mb-8">
        🏁 Round {roundNumber} Done!
      </Wordmark>

      <Card title="This Round" padding="lg" className="mb-5">
        {byPosition.map((lp) => {
          const isTied = lockedPositions.filter((o) => o.turnsUsed === lp.turnsUsed).length > 1;
          return (
            <CardRow key={lp.playerId}>
              <span className="text-lg text-white">
                {getPositionEmoji(lp.position)} {lp.name}
                {isTied && <span className="ml-2 text-sm text-pop-amber">🤝 Tied</span>}
              </span>
              <span className="text-right">
                <span className="font-display text-lg font-extrabold text-pop-lime">
                  +{lp.points} pts
                </span>
                <span className="ml-3 text-sm text-white/40">({lp.turnsUsed} turns)</span>
              </span>
            </CardRow>
          );
        })}
      </Card>

      <Card title="Total Scores" padding="lg" className="mb-8">
        {ranked.map((p) => {
          const isLeading = p.total > 0 && p.total === ranked[0].total;
          const left = departedIds.includes(p.id);
          return (
            <CardRow key={p.id} className={left ? 'opacity-50' : ''}>
              <span className="text-lg text-white">
                {isLeading ? '👑 ' : ''}{p.name}
                {left && <span className="ml-2 text-sm text-white/50">left</span>}
              </span>
              <span className="font-display text-xl font-extrabold text-pop-purple">
                {p.total} pts
              </span>
            </CardRow>
          );
        })}
      </Card>

      <div className="flex flex-col gap-4">
        <Button variant="success" size="xl" fullWidth onClick={onNewRound}>
          🔄 New Round
        </Button>
        <Button variant="primary" size="xl" fullWidth onClick={onEndSession}>
          🏆 End &amp; See Leaderboard
        </Button>
      </div>
    </Screen>
  );
}
