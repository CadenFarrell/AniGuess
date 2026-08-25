import { useState } from 'react';
import { Badge, Button, Card } from '../../../shared/ui';
import CategoryPicker from './CategoryPicker';

/**
 * CHOSEN MODE's opening phase: everybody commits a clause before anybody names
 * anything.
 *
 * ONE COMPONENT FOR LOCAL AND ONLINE, for the reason TurnScreen is one: the
 * moment genuinely is the same moment, and what differs is only which device is
 * looking. Online this renders once per device and then waits; locally it
 * renders once per player in turn, with `handover` gating each one behind a
 * "pass it over" screen.
 *
 * THE HANDOVER IS THE ONLY PRIVATE MOMENT LOCAL PLAY HAS, and it is worth being
 * exact about why there is only one. Dealt mode has to hide the hot seat's
 * clause for a whole turn, so it needs CategoryPeek on every judging screen.
 * Here a clause has to be on screen exactly once — while its owner picks it —
 * because from then on every judge rules from memory. So the device is passed
 * round once at the start of a round and then sits in the middle of the table
 * with nothing hidden on it, which is roughly twenty fewer handovers a round
 * than the alternative.
 *
 * The gate RESETS DURING RENDER when the player changes, which is React's
 * documented way to adjust state on a prop change and the idiom CategoryPeek
 * already uses. An effect would repaint once with the previous player's picker
 * still open — handing the next person a screen the last one was using.
 */
export default function PickPhase({
  playerName, suggestions, noun, onPick,
  handover = false, busy = false,
  done = false, waitingOn = [], picked = 0, total = 0,
}) {
  const [ready, setReady] = useState(!handover);
  const [lastPlayer, setLastPlayer] = useState(playerName);
  if (lastPlayer !== playerName) {
    setLastPlayer(playerName);
    setReady(!handover);
  }

  const header = (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-display text-xs font-extrabold uppercase tracking-widest text-white/50">
          Everyone picks a category
        </p>
        <h2 className="truncate font-display text-2xl font-extrabold text-white">
          {done ? 'Locked in' : `${playerName}, choose yours`}
        </h2>
      </div>
      {total > 0 && (
        <Badge tone={picked >= total ? 'lime' : 'neutral'} className="flex-shrink-0 text-base">
          {picked} of {total}
        </Badge>
      )}
    </div>
  );

  // Online, after this device has committed. Nothing to do but say who is left,
  // by name — a bare spinner here reads as the room having stalled.
  if (done) {
    return (
      <>
        {header}
        <Card padding="lg" className="text-center">
          <p className="font-display text-xl font-extrabold text-white">
            {waitingOn.length
              ? `Waiting on ${waitingOn.map((p) => p.name).join(', ')}…`
              : 'Starting the round…'}
          </p>
          <p className="mt-3 text-base text-white/50">
            Keep your category to yourself. Everything you answer from here is judged
            against it, and working it out is the whole game.
          </p>
        </Card>
      </>
    );
  }

  // Local, between two players. Deliberately says nothing about the clause just
  // committed — the point of the screen is that the last one is already gone.
  if (!ready) {
    return (
      <>
        {header}
        <Card padding="lg" className="mb-6 text-center">
          <p className="text-4xl">🤝</p>
          <p className="mt-3 font-display text-xl font-extrabold text-white">
            Pass the device to {playerName}
          </p>
          <p className="mt-2 text-base text-white/50">
            Everyone else, look away — this is the one screen in the round that is private.
            After this the device sits in the middle and you each name one thing in turn.
          </p>
        </Card>
        <Button variant="primary" size="lg" fullWidth onClick={() => setReady(true)}>
          I&apos;m {playerName} — show me the list
        </Button>
      </>
    );
  }

  return (
    <>
      {header}
      {/* A sentence rather than a panel. It used to be a whole Card holding one
          line of grey text, which spent a surface on a caption and left the
          picker below it looking like the second thing on the screen. */}
      <p className="mb-5 text-base text-white/60">
        Pick something you can answer yes or no about instantly, for any {noun} anyone names.
      </p>
      <CategoryPicker suggestions={suggestions} noun={noun} onPick={onPick} busy={busy} />
    </>
  );
}
