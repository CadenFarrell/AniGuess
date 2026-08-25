import { useEffect, useRef, useState } from 'react';
import SecretCard from './SecretCard';
import { Backdrop, Button, Screen, Wordmark } from '../../../shared/ui';

// How long after this screen appears the "show me" button ignores a tap.
//
// The hand-off is the one place in the app where a stray tap costs something
// real: "🙈 Hide & pass on" and "👀 I'm X — show me" are both a full-width
// primary block, and the card above them changes height with its content, so the
// two land within a few pixels of each other about as often as not. A bounced
// tap, a double-tap, or a touch begun before the commit therefore hides one
// player's card and immediately opens the NEXT player's, with nobody having
// passed anything. Reproduced in a browser with two clicks at one coordinate;
// the number is a judgement call, not a measurement — long enough to outlast a
// double-tap, short enough that nobody meets it honestly, since the phone is
// still travelling across the table.
const ARM_MS = 400;

// Local play only: one device, several people, so each card has to be looked at
// alone. Two taps per player — claim the device, then hide and pass it on —
// with the card never on screen either side of that.
//
// Online walks nobody through anything: the card is shown inline, because the
// device is already private. It does still gate on everyone having answered the
// card check (components/CardCheck.jsx), which is a readiness gate and therefore
// one more thing a closed tab could wedge — rules.everyoneChecked counts the
// ACTIVE roster for exactly that reason.
//
// `onNext` takes whether this player asked for a fresh card. It is NOT acted on
// here: the caller collects every answer before anything happens, because
// re-dealing the moment someone asks restarts the walk right after their turn
// and names them. See LocalRound.
export default function SecretReveal({
  player, card, isLast, canRedeal, dealNumber, maxDeals, onNext,
}) {
  const [showing, setShowing] = useState(false);
  // When this screen appeared. A ref rather than a timer plus `disabled`, so the
  // button never greys out and back in for a beat the player would read as the
  // app stalling — the guard is invisible unless you trip it.
  //
  // Stamped in an effect, not at `useRef(Date.now())`: that reads a clock during
  // render, which is impure and which the react-hooks/purity rule rejects
  // outright. Null until the effect runs, and the handler treats null as NOT
  // armed, so the gap between render and effect fails closed rather than open.
  //
  // This works per PLAYER only because LocalRound keys this component on the
  // player and the deal: without that key one instance is reused for the whole
  // walk, the effect runs once at the top of the pass, and every later hand-off
  // is armed the instant it appears. The key and this guard are one fix split
  // across two files — neither is much use alone.
  const shownAt = useRef(null);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  // Same shape as CardCheck's, so the two halves say the same number the same
  // way. `canRedeal` is still the gate rather than this — it also carries
  // whether the table turned the check off at all, which a count cannot.
  const dealsLeft = Math.max(0, maxDeals - dealNumber);
  // `isFake` is only ever true in blind mode — dealRoles forces it false in
  // decoy — so this needs no mode prop and cannot accidentally strip the button
  // from a decoy fake, who must keep it. See rules.js's "WHO MAY ASK".
  const blindFake = Boolean(card?.isFake);

  return (
    <>
      <Backdrop />
      <Screen center>
        {!showing ? (
          <>
            <Wordmark tone="teal" size="md" level={2} className="mb-8">
              🕵️ Pass the device
            </Wordmark>
            <p className="mb-2 text-center text-xl text-white/60">Hand it to</p>
            <p className="mb-10 text-center font-display text-4xl font-extrabold text-white">
              {player.name}
            </p>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => {
                // Swallowed, not queued: a tap this early was aimed at the
                // previous screen's button, so honouring it late would be the
                // same leak one frame further on. See ARM_MS.
                if (shownAt.current === null) return;
                if (Date.now() - shownAt.current < ARM_MS) return;
                setShowing(true);
              }}
            >
              👀 I&apos;m {player.name} — show me
            </Button>
          </>
        ) : (
          <>
            <Wordmark tone="teal" size="sm" level={2} className="mb-6">
              {player.name}
            </Wordmark>
            <div className="mb-8">
              <SecretCard card={card} />
            </div>
            {/* True of the fake's one-word hint as much as of a character:
                local play shows the card once and there is no private device to
                keep it on, so the word has to be held in your head. */}
            <p className="mb-6 text-center text-white/50">
              Memorize it — you won&apos;t see it again until the reveal.
            </p>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => { setShowing(false); onNext(false); }}
            >
              {/* Phase-neutral while a re-deal is still possible, deliberately.
                  "Start the clues" on the last player's button would tell that
                  player from the label alone that nobody asked — and at three
                  players, if they confirmed themselves, that is a one-in-two
                  accusation handed out for free. */}
              {isLast && !canRedeal ? '🙈 Hide & start the clues' : '🙈 Hide & pass on'}
            </Button>
            {canRedeal && (blindFake ? (
              // Said plainly, because only this player ever reads it: without a
              // word here they are left wondering whether they missed the button
              // the player before them at the table visibly had.
              <p className="mt-4 text-center text-sm text-white/40">
                You hold no character, so there&apos;s nothing for you to not-know.
                If someone else asks, you&apos;ll get a new hint.
              </p>
            ) : (
              <>
                {/* A full block rather than the GhostButton this used to be, for
                    CardCheck's reason — and one more that was local-only: ghost
                    is not `fullWidth` and Screen does not centre its children, so
                    this rendered LEFT-aligned under a centred full-width block,
                    with its own centred caption beneath it. Three elements, three
                    alignments, and the odd one out was the control. */}
                <Button
                  variant="neutral"
                  size="lg"
                  fullWidth
                  className="mt-3"
                  onClick={() => { setShowing(false); onNext(true); }}
                >
                  🔁 Deal again — I can&apos;t work with this
                </Button>
                {/* The last sentence matches CardCheck's word for word — see the
                    note there for why the pinned role is stated publicly, and why
                    this screen rather than the setup card is where it belongs. */}
                <p className="mt-3 text-center text-sm text-white/40">
                  Nobody is told who asked. Nothing happens until everyone has looked —
                  then everyone gets a new character
                  {dealsLeft === 1 ? ', one more time.' : `, up to ${dealsLeft} more times.`}
                  {' '}It never changes who the fake is.
                </p>
              </>
            ))}
          </>
        )}
      </Screen>
    </>
  );
}
