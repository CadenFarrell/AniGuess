/**
 * The rotation, drawn as one row of chips.
 *
 * THE SEAT MOVES AFTER EVERY SINGLE NAME, and without this the only evidence of
 * that is a heading that changes — which reads as the game having jumped rather
 * than as a turn having passed. So the whole order is on screen at once, always
 * in roster order, because roster order IS seat order (see rules.turnOrder): the
 * seat walks forward through this list and wraps, so the next player is always
 * the next chip that is still in.
 *
 * A CHIP SAYS ONE OF THREE THINGS, and they are three states rather than two:
 *
 *   up        purple, the arcade's whose-turn colour everywhere else
 *   still in  their names left, so the table can see who is running low
 *   finished  what they finished WITH — a solve and a give-up are both "done"
 *             and drawing them alike would throw away the only news of the round
 *
 * `left` is deliberately shown rather than `used`: the number that changes a
 * decision is how many you have got, not how many you have spent.
 */
export default function SeatStrip({ order = [], myPlayerId = null, className = '' }) {
  if (order.length < 2) return null;

  return (
    <ol className={`flex flex-wrap items-stretch gap-2 ${className}`} aria-label="Turn order">
      {order.map((row) => {
        const isMe = !!myPlayerId && row.playerId === myPlayerId;
        // Ordered loudest first: whose turn it is beats every other fact on the
        // strip, because it is the only one that asks somebody to do something.
        const tone = row.isSeat
          ? 'border-pop-purple bg-pop-purple/20 text-white'
          : row.done
            ? 'border-white/10 bg-white/5 text-white/40'
            : row.away
              ? 'border-pop-amber/40 bg-pop-amber/10 text-white/50'
              : 'border-white/10 bg-white/5 text-white/70';

        const status = () => {
          if (row.away) return 'away';
          if (row.done) return row.solved ? '✓ solved' : 'out';
          if (row.isSeat) return 'naming now';
          return `${row.left} left`;
        };

        return (
          <li
            key={row.playerId}
            aria-current={row.isSeat ? 'true' : undefined}
            className={`min-w-0 flex-1 basis-24 rounded-pop-sm border-2 px-2.5 py-1.5 ${tone}`}
          >
            <p className="truncate font-display text-sm font-extrabold">
              {isMe ? 'You' : row.name}
            </p>
            <p
              className={`truncate font-display text-xs font-bold uppercase tracking-wider
                ${row.solved && row.done ? 'text-pop-lime' : 'opacity-60'}`}
            >
              {status()}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
