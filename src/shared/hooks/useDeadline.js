import { useEffect, useState } from 'react';
import { remainingMs, isExpired, elapsedFraction } from '../utils/deadline';

// Re-renders while a deadline is running so a countdown moves, and reports when
// it has passed. The arithmetic lives in shared/utils/deadline.js; all this owns
// is when to re-read the clock.
//
// Generalised from useRoomCore's grace countdown, whose two properties are the
// reason this exists rather than a bare setInterval in each screen:
//
//   1. The interval only runs while there is a live deadline. An idle round
//      shouldn't re-render every tick for the whole game.
//   2. A hidden tab has its timers throttled hard — Chrome drops to roughly one
//      wake-up a minute after a few minutes backgrounded — so a player coming
//      back from another app would stare at a frozen clock, and worse, an
//      *expired* round would not notice for up to a minute. Re-reading on
//      visibilitychange closes both gaps the instant they return.
//
// `offsetMs` is the server-clock correction (useRoomCore's serverOffset).
// Online passes it so every device agrees on the same instant; local play passes
// nothing, because there is only one clock to agree with.
//
// `tickMs` defaults to 100 rather than 1000: this drives a progress bar, and a
// bar that steps once a second reads as broken next to audio that is plainly
// still playing. The interval is cheap and only exists while a window is open.
export function useDeadline(deadlineAt, { offsetMs = 0, windowMs = null, tickMs = 100 } = {}) {
  const [now, setNow] = useState(() => Date.now());

  const active = deadlineAt != null && Number.isFinite(deadlineAt);
  const expired = isExpired(deadlineAt, now + offsetMs);

  useEffect(() => {
    // Stop ticking once it has passed: the values below are all clamped, so
    // further reads cannot change anything a caller renders.
    if (!active || expired) return undefined;
    const tick = () => setNow(Date.now());
    // Read once on the way in. The stored `now` is from whenever this component
    // last rendered, which for a deadline arriving over the network can be
    // meaningfully stale — and stale here means the bar starts full.
    tick();
    const id = setInterval(tick, tickMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [active, expired, tickMs, deadlineAt]);

  const corrected = now + offsetMs;
  const left = remainingMs(deadlineAt, corrected);
  return {
    remainingMs: left,
    secondsLeft: Math.ceil(left / 1000),
    expired,
    // Fraction elapsed, so a bar drains left-to-right as `1 - fraction`.
    // Derived from windowMs when given (the honest denominator) and from the
    // time left otherwise, which is all a caller without the window can know.
    fraction: windowMs
      ? elapsedFraction(deadlineAt - windowMs, windowMs, corrected)
      : (active && !expired ? 0 : 1),
  };
}

export default useDeadline;
