import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import { Backdrop, Button, Card, CardRow, GhostButton, Screen, Wordmark } from '../../../shared/ui';

export default function AniTuneResults({ players, scores, roundSize, onPlayAgain, onExit }) {
  const ranked = computeRankedPlayers(players, scores);

  return (
    <>
      <Backdrop />
      <Screen center width="md">
        <Wordmark tone="blue" size="md" level={2} className="mb-8">
          🏆 Final Scores
        </Wordmark>

        <Card padding="sm" className="mb-8">
          {ranked.map((p) => (
            <CardRow key={p.id}>
              <span className="w-10 text-2xl">{getPositionEmoji(p.position)}</span>
              <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-extrabold text-white">
                {p.name}
              </span>
              <span className="font-display text-xl font-extrabold text-pop-amber">
                {p.total} / {roundSize}
              </span>
            </CardRow>
          ))}
        </Card>

        <Button variant="success" size="xl" fullWidth onClick={onPlayAgain}>
          🔁 Play again
        </Button>

        <div className="mt-4 text-center">
          <GhostButton onClick={onExit}>← Back to hub</GhostButton>
        </div>
      </Screen>
    </>
  );
}
