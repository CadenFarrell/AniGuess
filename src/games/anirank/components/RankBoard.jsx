import { Badge, Button, Card } from '../../../shared/ui';
import { railTone } from '../utils/rail';

// The ten slots. Shared by local and online play, and by both ways a round can
// be dealt — it renders one board and reports which slot was tapped, and knows
// nothing about whose board it is or where the state lives.
//
// What the ends of the board MEAN comes from the round's axis (see ../axes.js).
// The orientation itself never varies: slot 1 is the TOP of the ranking — the
// most of whatever is being ranked this round — and slot 10 is the bottom.
//
// Three things say so, deliberately overlapping, because a board that is only
// numbered leaves the player guessing whether #1 is the best or the worst:
//
//   the end caps   name the axis end AND the slot number at each end, so the
//                  convention is stated rather than inferred
//   the rail       a stepped amber bar down the left, strongest at the top —
//                  the direction readable before any text is
//   the chips      1…10 top to bottom, and the aria-labels that go with them
//
// Only the caps and chips are load-bearing. The rail is aria-hidden and carries
// no information the other two don't, which is what keeps the board off
// colour-alone as a channel and stops screen readers announcing the order twice.
//
// Two modes, and the optional handlers are the switch between them:
//
//   blind  `item` is the one card being dealt. Tapping an empty slot commits it
//          there permanently, which is the whole game, so a mis-tap cannot be
//          undone and the board is small on a phone. Filled slots are inert.
//   open   `item` is whichever card the player is holding — from the tray or
//          lifted back off the board. `onPickUp` makes a filled slot tappable
//          (pick it up, or drop the held card on it to swap), and `onClear`
//          sends one back to the tray. Nothing counts until they lock in.
//
// Picking a card up deliberately does NOT remove it from the board: the board
// stays full, so the lock-in button does not flicker off every time someone
// reconsiders a slot.
// The rail's steps live in ../utils/rail.js: the reveal redraws the same board
// to explain the score, and a second copy of the ladder would be free to drift
// out of step with this one.

// One end of the board: the slot number and what the axis calls that end. Both
// halves matter — the number alone doesn't say which end is better, and the
// label alone doesn't say which slot it belongs to.
function EndCap({ slot, label, arrow, className = '' }) {
  return (
    <div className={`flex items-baseline justify-center gap-2 px-1 ${className}`}>
      <span className="font-display text-xs font-black tracking-widest text-white/30">
        #{slot}
      </span>
      <span className="font-display text-sm font-black tracking-widest text-pop-amber">
        {arrow} {label}
      </span>
    </div>
  );
}

export default function RankBoard({
  board, item, selectedId = null, disabled = false,
  topLabel = 'TOP', bottomLabel = 'BOTTOM', onPlace, onClear, onPickUp,
}) {
  return (
    <Card padding="sm" className="mb-6">
      <EndCap slot={1} label={topLabel} arrow="▲" className="mb-2" />

      <ol className="flex flex-col gap-2">
        {board.map((slot, i) => {
          const empty = slot == null;
          const canPlace = empty && !disabled && !!item;
          const canClear = !empty && !disabled && !!onClear;
          const canPickUp = !empty && !disabled && !!onPickUp;
          const held = !empty && slot.id === selectedId;
          // Built as one string rather than appended conditionally: two Tailwind
          // classes setting the same property win by stylesheet order, not by
          // the order they appear in the attribute.
          const tone = empty
            ? canPlace
              ? 'border-pop-amber/60 bg-pop-amber/10 hover:border-pop-amber hover:bg-pop-amber/20'
              : 'border-white/10 bg-surface-2/40'
            : held
              ? 'border-pop-amber bg-pop-amber/20'
              : canPickUp
                ? 'border-white/15 bg-surface-2 hover:border-white/40'
                : 'border-white/15 bg-surface-2';
          const shell = `flex min-w-0 flex-1 items-center gap-3 rounded-pop-sm border-2 px-3 py-2.5
            text-left transition-colors ${tone}`;
          // Inside the <li> rather than a column beside the <ol>: as a sibling it
          // would have to re-derive each row's height to stay aligned, and a row
          // that wraps or grows would silently drift out of step with it.
          const railBar = (
            <span
              aria-hidden="true"
              className={`w-1.5 flex-shrink-0 rounded-full ${railTone(i, board.length)}`}
            />
          );
          const rank = (
            <span
              className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-pop-sm
                font-display text-sm font-black
                ${empty ? 'bg-white/10 text-white/40' : 'bg-pop-amber text-ink'}`}
            >
              {i + 1}
            </span>
          );

          const title = (
            <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-white">
              {slot?.title}
            </span>
          );

          // A filled slot in an open round carries its own ✕, so the row cannot
          // itself be a button: nesting one inside another is invalid markup and
          // the inner click never arrives. The row's tappable area is therefore a
          // button *beside* the ✕, stretched to fill what is left.
          if (!empty) {
            return (
              <li key={i} className="flex items-stretch gap-2">
                {railBar}
                <div className={shell}>
                  {canPickUp ? (
                    <button
                      onClick={() => onPickUp(i)}
                      aria-pressed={held}
                      aria-label={
                        held
                          ? `${slot.title} lifted from slot ${i + 1} — tap another slot to move it`
                          : item
                            ? `Swap ${item.title} with ${slot.title} in slot ${i + 1}`
                            : `Pick up ${slot.title} from slot ${i + 1}`
                      }
                      className="focus-pop flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {rank}
                      {title}
                    </button>
                  ) : (
                    <>
                      {rank}
                      {title}
                    </>
                  )}
                  {canClear && (
                    <button
                      onClick={() => onClear(i)}
                      aria-label={`Take ${slot.title} out of slot ${i + 1}`}
                      className="focus-pop grid h-8 w-8 flex-shrink-0 place-items-center
                        rounded-pop-sm text-base font-black text-white/40 transition-colors
                        hover:bg-white/10 hover:text-pop-red"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            );
          }

          return (
            <li key={i} className="flex items-stretch gap-2">
              {railBar}
              <button
                onClick={() => canPlace && onPlace(i)}
                disabled={!canPlace}
                // Names the card that would actually land here — in an open round
                // that is whichever tray card is picked up, not a dealt card.
                aria-label={item ? `Place ${item.title} in slot ${i + 1}` : `Empty slot ${i + 1}`}
                className={`focus-pop ${shell}`}
              >
                {rank}
                <span className="font-display text-base font-bold text-white/30">
                  {canPlace ? 'Tap to place here' : '—'}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <EndCap slot={board.length} label={bottomLabel} arrow="▼" className="mt-2" />
    </Card>
  );
}

// The card currently being placed, shown above the board. A card is a show or a
// character depending on the axis; `subtitle` is the show a character came from,
// and is stamped by the deck builder rather than derived here.
export function CurrentItem({ item, index, total }) {
  if (!item) return null;
  return (
    <div className="mb-6 text-center">
      <p className="mb-2 text-base text-white/40">
        Card {index + 1} of {total}
      </p>
      {item.imageUrl && (
        <img
          src={item.imageUrl}
          alt=""
          className="mx-auto mb-3 h-40 w-auto rounded-pop border-2 border-ink object-cover"
        />
      )}
      <h2 className="font-display text-3xl font-extrabold text-white">{item.title}</h2>
      {/* `value` is the answer on a fact axis — never rendered before the reveal. */}
      {item.subtitle && <p className="mt-2 text-lg text-white/60">{item.subtitle}</p>}
    </div>
  );
}

// The cards still to be placed in an open round. Tap one to pick it up, then tap
// a slot to drop it — tap-to-select rather than drag-and-drop, because the board
// is built for a phone and a drag needs a library and a mouse to feel right.
//
// Renders nothing once the tray is empty, so the board is the only thing between
// a finished ranking and the lock-in button.
export function CardTray({ items, selectedId, onSelect }) {
  if (!items?.length) return null;
  return (
    <Card padding="sm" className="mb-4">
      <p className="mb-3 px-1 font-display text-sm font-bold tracking-widest text-white/40">
        {items.length} LEFT TO PLACE
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                onClick={() => onSelect(selected ? null : item.id)}
                aria-pressed={selected}
                className={`focus-pop flex w-24 flex-col items-center gap-1.5 rounded-pop-sm border-2
                  p-2 transition-colors
                  ${selected
                    ? 'border-pop-amber bg-pop-amber/20'
                    : 'border-white/15 bg-surface-2 hover:border-white/40'}`}
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-24 w-full rounded-pop-sm border-2 border-ink object-cover"
                  />
                )}
                <span className="line-clamp-2 font-display text-xs font-bold leading-tight text-white">
                  {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Commits a finished open board. Disabled until every slot is filled, mirroring
// rules.lockIn, which refuses a partial board — a half-ranked board would end
// the round early and, from an opinion subject, leave holes in the answer key.
export function LockInButton({ ready, onLockIn }) {
  return (
    <div className="mb-6">
      <Button variant="primary" size="xl" fullWidth disabled={!ready} onClick={onLockIn}>
        {ready ? '🔒 Lock in board' : 'Fill every slot to lock in'}
      </Button>
    </div>
  );
}

export function PlacerBanner({ name, placed, total, verb = 'placed' }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
      <Badge tone="purple" className="text-lg">{name}&rsquo;s turn</Badge>
      <span className="text-base text-white/40">{placed} of {total} {verb}</span>
    </div>
  );
}

export function WaitingOn({ names }) {
  if (!names.length) return null;
  return (
    <p className="mb-4 text-center text-base text-white/50">
      Waiting on {names.join(', ')}…
    </p>
  );
}
