import { Badge, Button, Card } from '../../../shared/ui';
import { getCategory } from '../categories';

/**
 * Everyone's round, side by side, at the end of one.
 *
 * The one screen where every clause is on show at once, which is the whole
 * reason it exists as a stop rather than as a jump straight to the next round:
 * the table spends a round each holding one clause, and this is where "we all
 * had shows about school" turns into a shared joke. In chosen mode it is also
 * the only moment an UNCLAIMED clause is ever shown — until here, revealing one
 * would have been worth full marks to the next player (see rules.revealAllowed).
 *
 * A CLAUSE IS SHOWN EVEN FOR A PLAYER WHO NEVER GOT A GO, and that is not the
 * same call the badges make. In chosen mode everybody picks one whether or not
 * they ever named anything, and hiding it because `took` is false would blank
 * the row of somebody the whole table spent the round questioning. The score,
 * meanwhile, still separates "played and missed" from "never got going" — both
 * are zero, and a scoreboard that ran them together would accuse somebody whose
 * tab closed of having played badly.
 *
 * A GRID RATHER THAN A WRAPPING FLEX ROW. The badges used to drop under the name
 * on a narrow screen, which doubled the row height for exactly the players who
 * had the most to say; a fixed right-hand column keeps every score in one
 * vertical line, which is what makes it scannable as a scoreboard at all.
 */
export default function RoundEnd({
  explain, players, roundNumber, totalRounds, isFinalRound, chosen = false,
  canAdvance, hostName, onNext, onFinish,
}) {
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? 'Someone';

  // Whose clause the row's player went after, and who went after theirs. Only
  // chosen mode has either; in dealt mode the only clause in play on your go is
  // your own, so both are always null and the line collapses to nothing.
  const story = (row) => {
    if (!chosen) return null;
    const parts = [];
    if (row.solved && row.targetId) parts.push(`solved ${nameOf(row.targetId)}`);
    else if (row.took && row.guess && row.targetId) parts.push(`missed ${nameOf(row.targetId)}`);
    if (row.claimedBy) parts.push(`claimed by ${nameOf(row.claimedBy)}`);
    return parts.length ? parts.join(' · ') : null;
  };

  return (
    <>
      <Card title={`Round ${roundNumber} of ${totalRounds}`} padding="lg" className="mb-6">
        {explain.map((row) => {
          const line = story(row);
          return (
            <div
              key={row.playerId}
              className="grid grid-cols-[1fr_auto_3rem] items-center gap-3 border-b border-white/10
                py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-extrabold text-white">
                  {nameOf(row.playerId)}
                </p>
                <p className="truncate text-sm text-white/50">
                  {row.category ? getCategory(row.category).label : 'Category not revealed'}
                </p>
                {line && <p className="truncate text-sm text-white/40">{line}</p>}
              </div>
              {row.took ? (
                <Badge tone={row.solved ? 'lime' : 'red'}>
                  {row.solved ? `${row.used} name${row.used === 1 ? '' : 's'}` : 'missed'}
                </Badge>
              ) : (
                <Badge tone="neutral">no go</Badge>
              )}
              <span
                className={`text-right font-display text-lg font-extrabold
                  ${row.points > 0 ? 'text-pop-amber' : 'text-white/25'}`}
              >
                +{row.points}
              </span>
            </div>
          );
        })}
      </Card>

      {canAdvance ? (
        <Button
          variant={isFinalRound ? 'success' : 'primary'}
          size="lg"
          fullWidth
          onClick={isFinalRound ? onFinish : onNext}
        >
          {isFinalRound ? '🏁 See the final scores' : 'Next round →'}
        </Button>
      ) : (
        <p className="text-center text-base text-white/40">
          Waiting for {hostName || 'the host'} to move on…
        </p>
      )}
    </>
  );
}
