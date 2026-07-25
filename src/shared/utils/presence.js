// Who is actually still in an online room, derived from the shared presence
// records at rooms/{code}/state/presence/{playerId} that usePresence writes.
// (Not to be confused with games/aniguess/utils/whoIsWho.js, which builds the
// "who is who" recap panel.)
//
// Pure and backend-free, in the same spirit as the games' rules.js: the room
// hooks decide where presence lives and when to re-evaluate, this decides what
// it means. Both games' readiness gates ("everyone is ready", "everyone has
// answered", "everyone is locked out") count the roster, so a player who closes
// their tab would wedge the room forever unless they drop out of that count.

// How long a player may be disconnected before the room stops waiting for them.
// Long enough to survive a wifi blip, a tunnel, or a phone locking its screen;
// short enough that the survivors aren't left staring at a frozen round.
export const GRACE_MS = 20000;

// A presence record is one of:
//   undefined                                   — never written (old room, or
//                                                 a client that predates this)
//   { online: true }                            — connected right now
//   { online: false, at }                       — connection dropped at `at`
//   { online: false, left: true, at }           — pressed Leave deliberately
//
// 'dropping' is the grace window: still counted as present, but the room shows
// a countdown. 'gone' and 'left' are excluded from every gate.
export function playerStatus(entry, nowServerMs, graceMs = GRACE_MS) {
  // No record at all means the room predates presence tracking. Assume present:
  // wrongly waiting for someone is recoverable, wrongly ejecting them is not.
  if (!entry) return 'active';
  if (entry.left) return 'left';
  if (entry.online) return 'active';
  // Offline with no timestamp — we have no idea how long ago, and treating it
  // as freshly-dropped would restart the grace window on every read. Call it.
  if (typeof entry.at !== 'number') return 'gone';
  return nowServerMs - entry.at >= graceMs ? 'gone' : 'dropping';
}

export function isPresent(status) {
  return status === 'active' || status === 'dropping';
}

// Milliseconds left on a player's grace countdown, for the "waiting 12s…"
// banner. Zero for anyone who isn't mid-drop.
//
// Clamped to the grace window at the top end: callers tick `nowServerMs` from a
// timer that only runs while someone is dropping, so on the very first frame
// after a drop it can still hold a stale reading. Without the clamp that frame
// would flash a wildly inflated countdown before the next tick corrects it.
export function graceRemainingMs(entry, nowServerMs, graceMs = GRACE_MS) {
  if (!entry || entry.left || entry.online || typeof entry.at !== 'number') return 0;
  return Math.min(graceMs, Math.max(0, entry.at + graceMs - nowServerMs));
}

// One pass over the roster, since every caller wants several of these at once.
// `nowServerMs` must be server time (Date.now() + serverTimeOffset) so every
// device agrees on where the grace boundary falls.
export function rosterSnapshot(players, presence, nowServerMs, graceMs = GRACE_MS) {
  const statuses = {};
  const active = [];
  const departed = [];
  const dropping = [];

  for (const player of players) {
    const entry = presence?.[player.id];
    const status = playerStatus(entry, nowServerMs, graceMs);
    statuses[player.id] = status;
    if (isPresent(status)) active.push(player);
    else departed.push(player);
    if (status === 'dropping') {
      dropping.push({ player, remainingMs: graceRemainingMs(entry, nowServerMs, graceMs) });
    }
  }

  return {
    statuses,
    active,
    activeIds: active.map((p) => p.id),
    departed,
    departedIds: departed.map((p) => p.id),
    dropping,
  };
}

// Who inherits the crown when the host disappears: the longest-standing player
// still here, `players` being in join order. A fully-connected player is
// preferred over one mid-drop so the room doesn't have to migrate twice.
export function nextHostId(players, statuses) {
  const connected = players.find((p) => statuses[p.id] === 'active');
  if (connected) return connected.id;
  const dropping = players.find((p) => statuses[p.id] === 'dropping');
  return dropping ? dropping.id : null;
}
