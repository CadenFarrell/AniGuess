import { useState } from 'react';
import { Badge, Card } from '../../../shared/ui';
import TrailList from './TrailList';

/**
 * Every trail in the round, grouped by whose it is.
 *
 * THE SEAT MOVES AFTER EVERY NAME, WHICH IS WHY THIS EXISTS. The screen used to
 * render one trail — the current seat's — which was complete while a turn was an
 * uninterrupted block of ten. Now a player's own evidence leaves the screen the
 * instant they pass the device on, so the thing they spent the round collecting
 * would be visible only on the goes they are not taking.
 *
 * ONE BLOCK OPEN AT A TIME, and which one is not a preference: it is the one
 * you reason from — this device's player online, and whoever is up locally,
 * since the device is theirs for the moment.
 *
 * WHICH BLOCK OPENS AND WHICH IS CALLED "YOURS" ARE TWO QUESTIONS, hence two
 * props. Locally `myPlayerId` is null, because a shared device belongs to
 * nobody: every block is named, which is what stops "Your names" and "Caden's
 * names" sitting side by side with no way to tell whose the first one is now
 * that the seat moves every name.
 *
 * THE OTHERS ARE COLLAPSED RATHER THAN HIDDEN, and both halves matter. In chosen
 * mode every verdict on somebody else's name was given by the whole table
 * against their own clauses, so those rows are evidence about the very people
 * you are trying to declare — dropping them would remove most of the game. But
 * at four players an expanded board is four twenty-row lists, which is the wall
 * this file is here to avoid. So they are one tappable summary line each.
 *
 * Reset DURING RENDER when `open` changes, React's documented way to adjust
 * state on a prop change and the idiom CategoryPeek and TurnScreen already use:
 * an effect would repaint once with the previous player's block open, which on a
 * shared device is the next person reading the last person's notes.
 */
export default function TrailBoard({
  order = [], trails = {}, open: openFor = null, myPlayerId = null,
  cap, nameFor, usedFor, className = '',
}) {
  const [open, setOpen] = useState(openFor);
  const [lastOpenFor, setLastOpenFor] = useState(openFor);
  if (lastOpenFor !== openFor) {
    setLastOpenFor(openFor);
    setOpen(openFor);
  }

  // The one you reason from first, then the table in seat order — so the block
  // you want is always in the same place and the rest still read as the
  // rotation they are.
  const rows = [...order].sort((a, b) => (
    (b.playerId === openFor ? 1 : 0) - (a.playerId === openFor ? 1 : 0)
  ));
  if (!rows.length) return null;

  return (
    <Card padding="sm" className={className}>
      {rows.map((row, i) => {
        const isOpen = open === row.playerId;
        const trail = trails[row.playerId] ?? [];
        const used = usedFor?.(row.playerId) ?? trail.length;
        return (
          <div key={row.playerId} className={i ? 'mt-1 border-t border-white/10 pt-1' : ''}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : row.playerId)}
              className="focus-pop flex w-full items-center gap-3 rounded-pop-sm py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold
                uppercase tracking-widest text-white/60"
              >
                {row.playerId === myPlayerId ? 'Your names' : `${row.name}'s names`}
              </span>
              {/* The count is the cap warning as well as the count, which is why
                  it reddens: with the seat moving every name, "how much have I
                  got left" is the one number a player checks between goes. */}
              <Badge tone={Number.isFinite(cap) && used >= cap ? 'red' : 'neutral'}>
                {Number.isFinite(cap) ? `${used}/${cap}` : used}
              </Badge>
              <span aria-hidden="true" className="flex-shrink-0 text-white/40">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && <TrailList trail={trail} nameFor={nameFor} className="pb-1" />}
          </div>
        );
      })}
    </Card>
  );
}
