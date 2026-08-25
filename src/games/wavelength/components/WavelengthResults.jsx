import { Badge, Button, Card, CardRow, Screen, Wordmark } from '../../../shared/ui';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';

// End of session. computeRankedPlayers handles the tie rule (two players tied
// for 2nd are both 2nd, and the next is 3rd) so this screen never does its own
// sorting — every game in the arcade ends on the same leaderboard semantics.
export default function WavelengthResults({
  players, totalScores, onPlayAgain, onBack,
  playAgainLabel = 'Play again', backLabel = 'Change settings',
}) {
  const ranked = computeRankedPlayers(players, totalScores);

  return (
    <Screen>
      <Wordmark tone="purple" size="md" className="mb-8">Final scores</Wordmark>

      <Card padding="sm" className="mb-6">
        {ranked.map((p) => (
          <CardRow key={p.id}>
            <span className="w-10 flex-shrink-0 font-display text-xl font-extrabold">
              {getPositionEmoji(p.position)}
            </span>
            <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
              {p.name}
            </span>
            <Badge tone={p.position === 1 ? 'lime' : 'neutral'}>{p.total}</Badge>
          </CardRow>
        ))}
      </Card>

      <div className="flex flex-col gap-3">
        {/* Null online for everyone but the host — only they can move the room
            on, and a button that silently does nothing is worse than none. */}
        {onPlayAgain && (
          <Button variant="primary" size="xl" fullWidth onClick={onPlayAgain}>
            {playAgainLabel}
          </Button>
        )}
        <Button variant="neutral" size="lg" fullWidth onClick={onBack}>
          {backLabel}
        </Button>
      </div>
    </Screen>
  );
}
