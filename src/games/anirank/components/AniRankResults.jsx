import { scoreBoard, normalizeBoard, rankMap, truthFor } from '../rules';
import { getAxis, isOpinion } from '../axes';
import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';
import {
  Backdrop, Badge, Button, Card, GhostButton, Screen, Wordmark,
} from '../../../shared/ui';

// The reveal. Shows the answer key once, then each player's board against it —
// on a fact axis the `value` is deliberately never rendered before this screen.
//
// Three shapes over one layout, because the only thing that really differs is
// where the answer key came from and whether it is worth points:
//
//   fact + scoring     the true order, then everyone against it
//   opinion + scoring  the subject's own board, then everyone's guess at it
//   scoring off        every board side by side, no key and no points
export default function AniRankResults({
  players, boards, deck, axisId, subjectId, scoring = true, totalScores,
  departedIds = [], onPlayAgain, onExit, playAgainLabel = '🔁 Play again',
}) {
  const axis = getAxis(axisId);
  const opinion = isOpinion(axis);
  const subject = players.find((p) => p.id === subjectId) ?? null;

  // Rebuilt from the same helper the scoring used, so the strip below can never
  // disagree with the points awarded. Null when there is nothing to score
  // against — an unscored round, or a subject who never finished their board.
  const truth = scoring ? truthFor({ deck, boards, subjectId }, { opinion }) : null;
  const scored = Boolean(truth);

  // One shared ranking helper across the arcade, so ties behave the same way
  // here as they do on AniGuess's leaderboard.
  const ranked = scored ? computeRankedPlayers(players, totalScores) : players;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="amber" size="md" level={2} className="mb-2">
          📊 Results
        </Wordmark>
        <p className="mb-8 text-center text-base text-white/50">
          {axis.label}
          {opinion && subject && ` · as ${subject.name} would`}
        </p>

        {scored && (
          <Card
            title={opinion
              ? `${subject ? `${subject.name}’s` : 'The subject’s'} actual order`
              : 'The real order'}
            padding="lg"
            className="mb-6"
          >
            <ol className="flex flex-col gap-1.5">
              {truth.map((item, i) => (
                <li key={item.id} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-pop-sm
                    bg-pop-lime font-display text-sm font-black text-ink">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-white">
                    {item.title}
                  </span>
                  {/* Only a fact axis has a number to show — an opinion round's
                      key is a person's taste, which has no units. */}
                  {!opinion && item.value != null && (
                    <Badge tone="neutral">{axis.format(item.value)}</Badge>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        {!scored && (
          <p className="mb-6 text-center text-base text-white/50">
            {scoring
              ? 'No answer key this round — the subject never finished their board.'
              : 'No points this round. Compare, argue, move on.'}
          </p>
        )}

        <Card title={scored ? 'Scores' : 'Everyone’s boards'} padding="lg" className="mb-6">
          {ranked.map((p) => {
            const gone = departedIds.includes(p.id);
            const isSubject = opinion && p.id === subjectId;
            // The subject is never scored against the answer key, because they
            // ARE it — doing so returns a flawless board every time, which reads
            // as praise for a round they did not play.
            const result = scored && !isSubject ? scoreBoard(boards?.[p.id], deck, truth) : null;
            return (
              <div key={p.id} className={`mb-4 last:mb-0 ${gone ? 'opacity-40' : ''}`}>
                <div className="mb-2 flex items-center gap-2">
                  {scored && (
                    <span className="font-display text-lg font-black text-white/60">
                      {getPositionEmoji(p.position)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}{gone && ' · left'}
                  </span>
                  {isSubject && <Badge tone="purple">Subject</Badge>}
                  {result?.perfect && <Badge tone="lime">Perfect!</Badge>}
                  {scored && <Badge tone="amber">{p.total} pts</Badge>}
                </div>
                {/* No key for the subject's own row — every cell would be green
                    against itself, which says nothing. */}
                <PlayerRow board={boards?.[p.id]} deck={deck} truth={isSubject ? null : truth} />
                {isSubject && scored && (
                  // Explained inline, because a score you did not earn by
                  // guessing looks like a bug otherwise.
                  <p className="mt-1.5 text-sm text-white/40">
                    How predictable you were — the average of everyone&rsquo;s guesses
                  </p>
                )}
                {result && (
                  <p className="mt-1.5 text-sm text-white/40">
                    {result.ordered}/{deck.length - 1} pairs in order · {result.exact} exactly right
                  </p>
                )}
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

// One player's board as a strip of ten, each slot tinted by whether the card
// sitting there belongs after the one before it. With no answer key the strip
// still renders — it just shows what they picked, uncoloured.
function PlayerRow({ board, deck, truth }) {
  const filled = normalizeBoard(board, deck.length);
  const ranks = truth ? rankMap(truth) : null;
  const positionOf = new Map((truth ?? []).map((item, i) => [item.id, i + 1]));

  return (
    <div className="flex gap-1 overflow-x-auto">
      {filled.map((slot, i) => {
        const prev = filled[i - 1];
        // Each cell reports the pair to its LEFT — the same adjacent-pair test
        // scoreBoard counts, made visible. The first cell is deliberately
        // neutral: it has no pair to be judged against, and colouring it green
        // would claim a point that was never scored.
        const verdict = !slot || i === 0 || !ranks
          ? null
          : Boolean(prev && ranks[prev.id] != null && ranks[slot.id] != null
            && ranks[prev.id] <= ranks[slot.id]);
        const tone = !slot
          ? 'bg-surface-2 text-white/20'
          : verdict === null
            ? 'bg-white/15 text-white'
            : verdict ? 'bg-pop-lime text-ink' : 'bg-pop-red text-ink';
        return (
          <div
            key={i}
            title={slot ? slot.title : 'empty'}
            className={`grid h-9 min-w-9 flex-1 place-items-center rounded-pop-sm border-2 border-ink
              font-display text-xs font-black ${tone}`}
          >
            {slot ? (positionOf.get(slot.id) ?? (i + 1)) : '–'}
          </div>
        );
      })}
    </div>
  );
}
