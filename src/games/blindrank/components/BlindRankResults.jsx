import { trueOrder, scoreBoard, normalizeBoard } from '../rules';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import {
  Backdrop, Badge, Button, Card, GhostButton, Screen, Wordmark,
} from '../../../shared/ui';

// The reveal. Shows the answer once, then each player's board against it —
// the year is deliberately never rendered anywhere before this screen.
export default function BlindRankResults({
  players, boards, deck, totalScores, departedIds = [], onPlayAgain, onExit, playAgainLabel = '🔁 Play again',
}) {
  const truth = trueOrder(deck);
  // One shared ranking helper across the arcade, so ties behave the same way
  // here as they do on AniGuess's leaderboard.
  const ranked = computeRankedPlayers(players, totalScores);

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="amber" size="md" level={2} className="mb-8">
          📊 Results
        </Wordmark>

        <Card title="The real order" padding="lg" className="mb-6">
          <ol className="flex flex-col gap-1.5">
            {truth.map((show, i) => (
              <li key={show.id} className="flex items-center gap-3">
                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-pop-sm
                  bg-pop-lime font-display text-sm font-black text-ink">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-white">
                  {show.title}
                </span>
                <Badge tone="neutral">{show.year}</Badge>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Scores" padding="lg" className="mb-6">
          {ranked.map((p) => {
            const result = scoreBoard(boards?.[p.id], deck);
            const gone = departedIds.includes(p.id);
            return (
              <div key={p.id} className={`mb-4 last:mb-0 ${gone ? 'opacity-40' : ''}`}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-display text-lg font-black text-white/60">
                    {getPositionEmoji(p.position)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}{gone && ' · left'}
                  </span>
                  {result.perfect && <Badge tone="lime">Perfect!</Badge>}
                  <Badge tone="amber">{p.total} pts</Badge>
                </div>
                <PlayerRow board={boards?.[p.id]} deck={deck} truth={truth} />
                <p className="mt-1.5 text-sm text-white/40">
                  {result.ordered}/{deck.length - 1} pairs in order · {result.exact} exactly right
                </p>
              </div>
            );
          })}
        </Card>

        <Button variant="primary" size="xl" fullWidth onClick={onPlayAgain}>
          {playAgainLabel}
        </Button>
        <div className="mt-4 text-center">
          <GhostButton onClick={onExit}>← Back to hub</GhostButton>
        </div>
      </Screen>
    </>
  );
}

// One player's board as a strip of ten, each slot tinted by whether the show
// sitting there belongs after the one before it.
function PlayerRow({ board, deck, truth }) {
  const filled = normalizeBoard(board, deck.length);
  const rankOf = new Map(truth.map((s, i) => [s.id, i + 1]));

  return (
    <div className="flex gap-1 overflow-x-auto">
      {filled.map((slot, i) => {
        const prev = filled[i - 1];
        // Each cell reports the pair to its LEFT — the same adjacent-pair test
        // scoreBoard counts, made visible. The first cell is deliberately
        // neutral: it has no pair to be judged against, and colouring it green
        // would claim a point that was never scored.
        const verdict = !slot || i === 0 ? null : Boolean(prev && prev.year <= slot.year);
        const tone = !slot
          ? 'bg-surface-2 text-white/20'
          : verdict === null
            ? 'bg-white/15 text-white'
            : verdict ? 'bg-pop-lime text-ink' : 'bg-pop-red text-ink';
        return (
          <div
            key={i}
            title={slot ? `${slot.title} (${slot.year})` : 'empty'}
            className={`grid h-9 min-w-9 flex-1 place-items-center rounded-pop-sm border-2 border-ink
              font-display text-xs font-black ${tone}`}
          >
            {slot ? rankOf.get(slot.id) ?? '?' : '–'}
          </div>
        );
      })}
    </div>
  );
}
