import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import { Backdrop, Button, Card, CardRow, GhostButton, Screen, Wordmark } from '../../../shared/ui';

// `departedIds` is online-only: anyone who left mid-match keeps the score they
// had, ranked alongside everyone else, but is dimmed and tagged so the standings
// don't read as though they played the whole round.
export default function AniTuneResults({
  players, scores, roundSize, departedIds = [], onPlayAgain, onExit,
}) {
  const ranked = computeRankedPlayers(players, scores);

  return (
    <>
      <Backdrop />
      <Screen center width="md">
        <Wordmark tone="blue" size="md" level={2} className="mb-8">
          🏆 Final Scores
        </Wordmark>

        <Card padding="sm" className="mb-8">
          {ranked.map((p) => {
            const left = departedIds.includes(p.id);
            return (
              <CardRow key={p.id} className={left ? 'opacity-50' : ''}>
                <span className="w-10 text-2xl">{getPositionEmoji(p.position)}</span>
                <span className="min-w-0 flex-1 truncate text-left font-display text-lg font-extrabold text-white">
                  {p.name}
                  {left && <span className="ml-2 text-sm font-bold text-white/50">left</span>}
                </span>
                <span className="font-display text-xl font-extrabold text-pop-amber">
                  {p.total} / {roundSize}
                </span>
              </CardRow>
            );
          })}
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
