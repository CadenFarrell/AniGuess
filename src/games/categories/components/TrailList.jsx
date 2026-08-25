import { Badge } from '../../../shared/ui';
import { verdictsOf } from '../rules';

/**
 * One player's names this round, and what the table said about each.
 *
 * PUBLIC, ON EVERY DEVICE, INCLUDING THE HOT SEAT'S. The trail is the entire
 * information channel of the game — the clauses are hidden but the evidence
 * about them is not — so this renders identically for the player inducing the
 * rules, the people answering, and anyone watching. Nothing here is gated on
 * who is looking.
 *
 * A BARE LIST RATHER THAN A CARD. It used to supply its own panel, which was
 * fine while exactly one trail was ever on screen; now the seat moves after
 * every name and TrailBoard stacks one of these per player, so a card each would
 * be cards inside a card. The wrapper owns the surface, this owns the rows.
 *
 * ONE NAME CARRIES ONE VERDICT OR SEVERAL, and the difference is the mode. In
 * dealt mode a single judge answers about the seat's own clause, so the badge
 * needs no owner — there is only one thing it could be about. In chosen mode
 * every player answers about THEIRS, so an unattributed row of yes/no would be
 * worthless: which player said no is the entire fact. verdictsOf is the one
 * place that flattens the three stored shapes (a map, a map of one, and a
 * pre-attribution scalar from an older build) so this only has to count them.
 *
 * A MISS IS A ROW LIKE ANY OTHER, and that is the point of storing it in the
 * trail: "you already tried 'wears glasses' at Sam" is exactly the thing a
 * player forgets, and it is also the record that stops them aiming there again
 * (rules.declaredTargets). It is marked rather than merely listed, because it
 * cost three names and the row has to say why the count jumped.
 *
 * A NO IS DRAWN AS LOUDLY AS A YES, and that is a deliberate reversal of the
 * arcade's usual palette rule. index.css assigns lime to yes/correct and red to
 * no/wrong, which is right everywhere else and actively misleading here: a `no`
 * is not a mistake, it is half the evidence, and a trail where the misses look
 * like failures reads as a scoreboard the player is losing rather than as the
 * notes they are meant to be reasoning from.
 */
export default function TrailList({ trail = [], nameFor, className = '' }) {
  if (!trail.length) {
    return (
      <p className={`py-2 text-base text-white/40 ${className}`}>
        Nothing named yet. Every answer — yes or no — narrows it down.
      </p>
    );
  }

  return (
    <ol className={`flex flex-col ${className}`}>
      {trail.map((entry, i) => {
        const verdicts = verdictsOf(entry);
        const missed = entry.kind === 'declaration';
        return (
          // Index-keyed deliberately: the same name can legitimately be offered
          // twice (a player forgetting they tried it is itself information the
          // table answers again), so the text is not a unique key and a list
          // that de-duplicated would silently swallow the repeat.
          <li
            key={i}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/10
              py-2.5 last:border-0"
          >
            <span
              className={`w-5 flex-shrink-0 text-right font-display text-sm font-extrabold
                ${missed ? 'text-pop-red/70' : 'text-white/40'}`}
            >
              {missed ? '✕' : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-lg text-white">
              {missed && <span className="text-white/40">guessed </span>}
              {entry.text}
              {missed && entry.targetId && (
                <span className="text-white/40"> at {nameFor?.(entry.targetId) ?? 'someone'}</span>
              )}
            </span>
            <span className="flex flex-shrink-0 flex-wrap justify-end gap-1.5">
              {verdicts.length ? verdicts.map(({ judgeId, verdict }) => (
                <Badge key={judgeId ?? 'only'} tone={verdict ? 'lime' : 'red'}>
                  {/* Named only when more than one person answered, which is
                      chosen mode. A lone "YES" needs no owner and a labelled one
                      is noise on every row. */}
                  {verdicts.length > 1 ? `${nameFor?.(judgeId) ?? '?'} ` : ''}
                  {verdict ? 'YES' : 'NO'}
                </Badge>
              )) : (
                // A name nobody was left to answer settles with no verdicts at
                // all — see rules.settlePending. Saying so beats a blank space
                // that reads as a badge failing to render.
                <Badge tone="neutral">—</Badge>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
