import { useCallback, useMemo, useState } from 'react';
import TierPublish from './components/TierPublish';
import RoomCompare from './components/RoomCompare';
import { eligibleItems } from './utils/deck';
import { Backdrop } from '../../shared/ui';

// The room's tier-list half: a thin view-router, the same shape TierMode.jsx is
// for local play. Kept beside OnlineGame rather than folded into its switch for
// the reason TierMode gives — the two share nothing past the lobby, and a router
// serving both would null-guard every branch against the other's state.
//
// Which screen you are on is LOCAL, not a room view. Publishing is the shared
// act; reading the comparison is not, and forcing the table onto one screen
// would mean whoever tapped first decided what everyone else was looking at.
// Same reasoning as OnlineGame's `selectedId`.

// The deck builder's two opinion probes. `kind: 'opinion'` is what makes them
// the WHOLE pool: a fact axis drops any item missing its stat, which on a
// profile imported before the stats existed would resolve a fraction of the
// cards. See the same pair in TierMode.jsx.
const SHOWS = { kind: 'opinion', items: 'shows' };
const CHARACTERS = { kind: 'opinion', items: 'characters' };

export default function RoomTiers({ room }) {
  const [view, setView] = useState('publish'); // publish | compare

  // Memoized around the `?? []`, not despite it. useRoomCore's `players` is
  // referentially stable between renders (it reads straight off state, with a
  // module-constant empty fallback), but a fresh `[]` here would be a new array
  // every render and the pools below — a full pass over every player's anime
  // list — would rebuild on each one.
  const players = useMemo(() => room.players ?? [], [room.players]);

  // Pools built from EVERY player and with sharedOnly off, unlike a round.
  // These resolve card ids to titles and cover images and nothing else — the
  // comparison itself is ids all the way down — so the widest pool is the right
  // one: narrowing it would leave a clash row printing a raw folded key instead
  // of a title, and a player who left would take their shows' titles with them.
  const pools = useMemo(() => ({
    shows: eligibleItems(players, { axis: SHOWS, sharedOnly: false }),
    characters: eligibleItems(players, { axis: CHARACTERS, sharedOnly: false }),
  }), [players]);

  // A list draws from the pool its OWN items field names, never the axis the
  // room happens to have selected — TierMode.jsx:45 makes the same call, and
  // without it opening a character list under a shows axis empties it.
  const cardsFor = useCallback(
    (list) => pools[list?.items] ?? pools.shows,
    [pools]
  );

  return (
    <>
      <Backdrop />
      {view === 'compare' ? (
        <RoomCompare
          players={players}
          tierLists={room.tierLists ?? {}}
          cardsFor={cardsFor}
          onBack={() => setView('publish')}
        />
      ) : (
        <TierPublish room={room} onCompare={() => setView('compare')} />
      )}
    </>
  );
}
