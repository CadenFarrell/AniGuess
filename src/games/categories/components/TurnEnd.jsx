import { Badge, Button, Card } from '../../../shared/ui';
import TrailBoard from './TrailBoard';

/**
 * One player's round is over, and — only when it is safe — what the clause was.
 *
 * IT NOW MEANS SOMETHING NARROWER THAN IT USED TO. While a turn was an
 * uninterrupted block of names this screen appeared once per player per round,
 * on every rotation. The seat moves after every name now, so it appears only
 * when somebody has actually FINISHED — solved it, given up, or spent their cap
 * — and a wrong guess does not bring it up at all. That is what makes it worth
 * being a full stop: everything smaller is a line on the turn screen.
 *
 * THE TWO MODES HAVE DIFFERENT AUDIENCES FOR THIS SCREEN, which is why it
 * branches here rather than in a caller.
 *
 * DEALT: the hot seat is the audience, and they are the only person at the
 * table who has not already seen the answer. Everyone else watched it all round;
 * this is the moment the one player it was hidden from finds out. So the clause
 * is the largest thing here, above the score.
 *
 * CHOSEN: the whole table is the audience, and a clause only appears if the
 * player CLAIMED somebody. That is not squeamishness, it is the scoring: a solve
 * with zero names spent pays the maximum, so revealing a clause nobody has
 * claimed would hand the next player full marks for a free re-declaration. A
 * correct claim closes that off (first claim wins — the target cannot be
 * declared again), so its clause can come out immediately; everything still
 * standing waits for the round to end. See rules.revealAllowed, which is what
 * actually decides, so this screen only has to say which of the two happened.
 *
 * `category` can legitimately be null for a beat even when it is allowed:
 * whichever device holds it has to publish it first (rules.attachCategory in
 * dealt mode, rules.publishCategory in chosen), and saying so is better than an
 * empty space that reads as the answer having been lost.
 */
export default function TurnEnd({
  seatName, isYou = false, chosen = false, category, targetName, result, points,
  order = [], trails = {}, cap, seatId = null, myPlayerId = null,
  nameFor, usedFor, canAdvance, isLastSeat, onNext,
}) {
  const solved = result?.solved === true;
  const claimed = chosen && solved;

  const heading = () => {
    if (!chosen) return isYou ? 'Your category was' : `${seatName}'s category was`;
    if (claimed) return `${isYou ? 'You' : seatName} got ${targetName ?? 'them'}`;
    if (result?.guess) return `${targetName ?? 'They'} kept it`;
    return isYou ? 'You are out of this round' : `${seatName} is out of this round`;
  };

  // The one line under the badges. Built here rather than as three conditional
  // paragraphs, which is what gave this card six text weights in a column.
  const footnote = () => {
    if (!result?.guess) return isYou ? 'No claim made.' : null;
    const said = `${solved ? 'Called it as' : 'Guessed'} “${result.guess}”${
      chosen && targetName ? ` at ${targetName}` : ''}`;
    if (!solved) return `${said}.`;
    return `${said}, ${result.used <= 1 ? 'straight out of nowhere' : `in ${result.used} names`}.`;
  };

  return (
    <>
      <Card padding="lg" className="mb-6 text-center">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
          {/* Built here rather than by the caller, which is how "Your" and an
              appended "'s" produced "Your's" the first time round. */}
          {heading()}
        </p>

        {/* Dealt always shows it; chosen shows it only on a claim. */}
        {(!chosen || claimed) && (category ? (
          <p className="mt-3 font-display text-3xl font-extrabold text-white">{category.label}</p>
        ) : (
          <p className="mt-3 font-display text-xl font-extrabold text-white/30">
            Waiting for it to be revealed…
          </p>
        ))}

        {chosen && !claimed && (
          <p className="mt-3 text-base text-white/50">
            {result?.guess
              ? 'Still anybody’s to claim — it stays secret until the round ends.'
              : 'Every category is still standing.'}
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-3">
          <Badge tone={solved ? 'lime' : 'red'} className="text-base">
            {solved ? 'SOLVED' : 'MISSED'}
          </Badge>
          <Badge tone={points > 0 ? 'amber' : 'neutral'} className="text-base">
            +{points}
          </Badge>
        </div>

        {footnote() && <p className="mt-3 text-sm text-white/40">{footnote()}</p>}
      </Card>

      {/* The whole board rather than one trail: by the time anybody finishes,
          every player has names on the table and the interesting comparison is
          across them. Theirs is the block that opens. */}
      <TrailBoard
        order={order}
        trails={trails}
        open={myPlayerId ?? seatId}
        myPlayerId={myPlayerId}
        cap={cap}
        nameFor={nameFor}
        usedFor={usedFor}
        className="mb-6"
      />

      {canAdvance ? (
        <Button variant="primary" size="lg" fullWidth onClick={onNext}>
          {isLastSeat ? 'Finish the round →' : 'Carry on →'}
        </Button>
      ) : (
        <p className="text-center text-base text-white/40">
          Waiting for the round to carry on…
        </p>
      )}
    </>
  );
}
