import SecretCard from './SecretCard';
import { Backdrop, Button, Screen, Wordmark } from '../../../shared/ui';

// The online half of the pre-clue card check: look at what you were dealt and
// either get on with it or ask for a fresh one. Local play has no screen of its
// own for this — SecretReveal already walks the table one card at a time, so the
// second button just hangs off that.
//
// NOTHING HERE MAY SAY WHO ASKED, OR HOW MANY DID. That is the whole reason the
// phase is shaped the way it is: in blind mode the fake holds no character, so a
// visible veto makes them bluff about a card they cannot see and catches them
// for a reason unrelated to how they played. The hook hands down a `phase`
// string rather than the underlying flag precisely so this component *cannot*
// render the correlation even by accident — see rules.respondToCheck and
// useAniFakeRoom's checkPhase.
//
// `pendingNames` is the exception and is safe: who has not answered YET is
// public by construction (everyone can see the room is waiting), and it says
// nothing about how anyone answered.
export default function CardCheck({
  card, phase, responded, pendingNames, dealNumber, maxDeals, onConfirm, onRedeal,
}) {
  const dealsLeft = Math.max(0, maxDeals - dealNumber);
  // A card is null in the window between the re-deal claim landing and the new
  // secrets/ value arriving — SecretCard renders "Waiting for the deal…", which
  // is exactly right, so this only has to keep the buttons out of reach.
  const waiting = responded || !card || phase !== 'responding';
  // Only ever true in blind mode — dealRoles forces isFake false in decoy, whose
  // fake must keep the button. See rules.js's "WHO MAY ASK".
  const blindFake = Boolean(card?.isFake);

  return (
    <>
      <Backdrop />
      <Screen center>
        <Wordmark tone="teal" size="md" level={2} className="mb-6">
          🃏 Your card
        </Wordmark>

        <div className="mb-6 w-full">
          <SecretCard card={card} />
        </div>

        {phase === 'redealing' ? (
          <p className="text-center text-lg text-white/60">
            🔁 Dealing a new character…
          </p>
        ) : waiting ? (
          <>
            <p className="text-center text-lg text-white/60">
              {phase === 'starting' ? 'Starting the clues…' : 'Waiting for everyone else…'}
            </p>
            {pendingNames.length > 0 && (
              <p className="mt-2 text-center text-white/40">
                Still looking: {pendingNames.join(', ')}
              </p>
            )}
          </>
        ) : (
          <>
            <Button variant="primary" size="xl" fullWidth onClick={onConfirm}>
              👍 I&apos;m good — start the clues
            </Button>
            {dealsLeft > 0 && (blindFake ? (
              // Only this player ever sees it — every device renders its own card
              // — so saying it costs nothing, and not saying it leaves them
              // hunting for a control the rules deliberately withhold.
              <p className="mt-4 text-center text-sm text-white/40">
                You hold no character, so there&apos;s nothing for you to not-know.
                If someone else asks, you&apos;ll get a new hint.
              </p>
            ) : (
              <>
                {/* A full block rather than the GhostButton this used to be.
                    Ghost is the app's low-emphasis navigation primitive — bare
                    text, no border, no shadow — and sitting it under a pop-pink
                    `xl` block made the one control a stuck player needs the least
                    visible thing on the screen. `neutral` at `lg` keeps the
                    hierarchy honest: confirming is still plainly the main tap. */}
                <Button variant="neutral" size="lg" fullWidth className="mt-3" onClick={onRedeal}>
                  🔁 Deal again — I can&apos;t work with this
                </Button>
                {/* "Nobody is told" is true; "nobody can tell" would not be. At
                    three players a confirmer who sees a re-deal happen knows one
                    of the other two asked, and no amount of code changes that —
                    so the copy claims only what the room actually guarantees. */}
                <p className="mt-3 text-center text-sm text-white/40">
                  Nobody is told who asked. If anyone does, everyone gets a new character —
                  {dealsLeft === 1 ? ' one more time.' : ` up to ${dealsLeft} more times.`}
                </p>
              </>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}
