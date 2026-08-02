import { Badge, Card } from '../../../shared/ui';

// The ten slots. Shared by local and online play — it renders one board and
// reports which slot was tapped, and knows nothing about whose board it is or
// where the state lives.
//
// Slot 1 is the oldest. Tapping an empty slot commits the current show there
// permanently, which is the whole game, so the confirm step is deliberate:
// a mis-tap cannot be undone and the board is small on a phone.
export default function RankBoard({ board, item, disabled = false, onPlace }) {
  return (
    <Card padding="sm" className="mb-6">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-display text-sm font-bold tracking-widest text-white/40">
          ← OLDEST
        </span>
        <span className="font-display text-sm font-bold tracking-widest text-white/40">
          NEWEST →
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {board.map((slot, i) => {
          const empty = slot == null;
          const canPlace = empty && !disabled && item;
          return (
            <li key={i}>
              <button
                onClick={() => canPlace && onPlace(i)}
                disabled={!canPlace}
                aria-label={
                  empty
                    ? `Place ${item?.title ?? 'show'} in slot ${i + 1}`
                    : `Slot ${i + 1}: ${slot.title}`
                }
                className={`focus-pop flex w-full items-center gap-3 rounded-pop-sm border-2 px-3 py-2.5
                  text-left transition-colors
                  ${empty
                    ? canPlace
                      ? 'border-pop-amber/60 bg-pop-amber/10 hover:border-pop-amber hover:bg-pop-amber/20'
                      : 'border-white/10 bg-surface-2/40'
                    : 'border-white/15 bg-surface-2'}`}
              >
                <span
                  className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-pop-sm
                    font-display text-sm font-black
                    ${empty ? 'bg-white/10 text-white/40' : 'bg-pop-amber text-ink'}`}
                >
                  {i + 1}
                </span>
                {empty ? (
                  <span className="font-display text-base font-bold text-white/30">
                    {canPlace ? 'Tap to place here' : '—'}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-white">
                    {slot.title}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// The show currently being placed, shown above the board.
export function CurrentShow({ item, index, total, subtitle }) {
  if (!item) return null;
  return (
    <div className="mb-6 text-center">
      <p className="mb-2 text-base text-white/40">
        Show {index + 1} of {total}
      </p>
      {item.coverImageUrl && (
        <img
          src={item.coverImageUrl}
          alt=""
          className="mx-auto mb-3 h-40 w-auto rounded-pop border-2 border-ink object-cover"
        />
      )}
      <h2 className="font-display text-3xl font-extrabold text-white">{item.title}</h2>
      {/* The year is the answer — never rendered before the reveal. */}
      {subtitle && <p className="mt-2 text-lg text-white/60">{subtitle}</p>}
    </div>
  );
}

export function PlacerBanner({ name, placed, total }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
      <Badge tone="purple" className="text-lg">{name}&rsquo;s turn</Badge>
      <span className="text-base text-white/40">{placed} of {total} placed</span>
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
