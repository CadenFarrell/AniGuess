import { useMemo, useState } from 'react';
import { compareLists } from '../tiers';
import CompareResult from './CompareResult';
import { Badge, Banner, Button, Card, Screen, Wordmark } from '../../../shared/ui';

// Everyone's published list against everyone else's.
//
// A matrix rather than a ranked list of pairs, because the question a table
// actually asks is "who is closest to ME" and a matrix answers that by reading
// one row. It scrolls horizontally inside its own container rather than making
// the page scroll — with eight players the header row is wider than a phone.
//
// The cell is a percentage and nothing else. Agreement has no good end: two
// people disagreeing about a hundred shows is a more interesting result than
// two people agreeing, so colouring high cells lime and low cells red — the
// meaning index.css assigns those — would be asserting something false. Amber
// is AniRank's accent and carries no verdict.
//
// The pairwise result is drawn by CompareResult, the same component TierCompare
// uses, so what a clash means is decided in one place.

const pairKey = (a, b) => [a, b].sort().join('::');

export default function RoomCompare({ players, tierLists, cardsFor, onBack }) {
  // Only players who actually sent something. A departed player who published
  // stays in — their list is still a real answer, and dropping it would quietly
  // change everyone else's numbers when they closed their tab.
  const entrants = useMemo(
    () => players.filter((p) => tierLists[p.id]),
    [players, tierLists]
  );

  const [pair, setPair] = useState(null); // { a, b } player ids

  // Every pairing, computed once. compareLists is O(shared²) and a shows list
  // runs to several hundred cards, so recomputing per render — six pairings for
  // four players, twenty-eight for eight — is the difference between instant and
  // visibly janky when the selection changes.
  const results = useMemo(() => {
    const out = new Map();
    for (let i = 0; i < entrants.length; i++) {
      for (let j = i + 1; j < entrants.length; j++) {
        const a = entrants[i];
        const b = entrants[j];
        const listA = tierLists[a.id];
        const listB = tierLists[b.id];
        // Two lists over different pools have no cards in common by
        // construction, so this is a mismatch to explain rather than a
        // comparison to render — the same guard TierCompare makes locally.
        out.set(
          pairKey(a.id, b.id),
          listA.items !== listB.items ? null : compareLists(listA, listB)
        );
      }
    }
    return out;
  }, [entrants, tierLists]);

  const selected = pair ? results.get(pairKey(pair.a, pair.b)) : null;
  const playerA = pair ? entrants.find((p) => p.id === pair.a) : null;
  const playerB = pair ? entrants.find((p) => p.id === pair.b) : null;

  // Card metadata for the selected pair, so the clash rows can show titles and
  // covers. Keyed off whichever pool that pair's lists were built from.
  const byId = useMemo(() => {
    if (!pair) return new Map();
    const list = tierLists[pair.a];
    return new Map(cardsFor(list).map((c) => [c.id, c]));
  }, [pair, tierLists, cardsFor]);

  const pct = (result) => (
    result?.comparisons ? Math.round((result.agree / result.comparisons) * 100) : null
  );

  return (
    <Screen width="lg" onBack={onBack} backLabel="← Sent lists">
      <Wordmark tone="amber" subtitle="Where the room agrees, and where it doesn't" className="mb-8">
        The room
      </Wordmark>

      {entrants.length < 2 ? (
        <Banner tone="warning" className="mb-4">
          ⚠️ Two lists are needed to compare. Only {entrants.length} has been sent.
        </Banner>
      ) : (
        <Card padding="lg" className="mb-6">
          {/* Its own scroll container, so a wide table never makes the page
              scroll sideways. */}
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full border-collapse text-center">
              <caption className="sr-only">
                Agreement between each pair of published lists, as a percentage. Select a cell
                to see where that pair disagrees.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2 text-left text-sm font-normal text-white/40">
                    agrees with →
                  </th>
                  {entrants.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className="max-w-24 truncate p-2 font-display text-sm font-extrabold text-white"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entrants.map((row) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className="max-w-24 truncate p-2 text-left font-display text-sm font-extrabold text-white"
                    >
                      {row.name}
                    </th>
                    {entrants.map((col) => {
                      if (row.id === col.id) {
                        return (
                          <td key={col.id} className="p-1 text-white/15" aria-label="same list">
                            —
                          </td>
                        );
                      }
                      const result = results.get(pairKey(row.id, col.id));
                      const value = pct(result);
                      const active = pair
                        && pairKey(pair.a, pair.b) === pairKey(row.id, col.id);
                      return (
                        <td key={col.id} className="p-1">
                          <button
                            onClick={() => setPair({ a: row.id, b: col.id })}
                            disabled={value == null}
                            aria-label={`${row.name} and ${col.name}: ${
                              value == null ? 'nothing in common' : `${value} percent agreement`
                            }`}
                            aria-pressed={!!active}
                            className={`focus-pop w-full rounded-pop-sm px-2 py-2 font-display
                              text-base font-extrabold transition-colors
                              ${value == null
                          ? 'cursor-not-allowed text-white/20'
                          : active
                            ? 'bg-pop-amber text-ink'
                            : 'text-pop-amber hover:bg-white/10'}`}
                          >
                            {value == null ? '–' : `${value}%`}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-sm text-white/40">
            Tap a number to see what those two disagree about.
          </p>
        </Card>
      )}

      {pair && !selected && (
        <Banner tone="warning" className="mb-4">
          ⚠️ {playerA?.name} ranked {tierLists[pair.a]?.items} and {playerB?.name} ranked{' '}
          {tierLists[pair.b]?.items}, so those two lists have nothing in common to compare.
        </Banner>
      )}

      {selected && selected.comparisons === 0 && (
        <Banner tone="warning" className="mb-4">
          ⚠️ {playerA?.name} and {playerB?.name} share {selected.shared}{' '}
          {selected.shared === 1 ? 'entry' : 'entries'} — not enough overlap to compare.
        </Banner>
      )}

      {selected && selected.comparisons > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="lime">{playerA?.name}</Badge>
            <span className="text-white/30">vs</span>
            <Badge tone="red">{playerB?.name}</Badge>
          </div>
          <CompareResult
            result={selected}
            ownerA={playerA?.name ?? 'them'}
            ownerB={playerB?.name ?? 'them'}
            byId={byId}
          />
        </>
      )}

      <Button variant="neutral" size="lg" fullWidth className="mt-6" onClick={onBack}>
        ← Back to sent lists
      </Button>
    </Screen>
  );
}
