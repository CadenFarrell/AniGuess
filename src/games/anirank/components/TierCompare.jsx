import { useMemo, useState } from 'react';
import { compareLists } from '../tiers';
import { Badge, Banner, Button, Card, Field, Screen, Select, Wordmark } from '../../../shared/ui';

// Two saved lists, side by side.
//
// The headline is an AGREEMENT PERCENTAGE and the body is a list of clashes,
// and that split is deliberate: the number says how close two people are, but
// nobody argues about a number. "You put this in S and they put it at #47" is
// the thing worth reading, and it needs no arithmetic to land.
//
// The ordering of that list is per-card CONFLICT COUNT, not the distance
// between two tiers — see compareLists, which inherits the reasoning from
// rules.js's explainBoard. It is also the only measure that survives comparing
// a tier list against a ranked one, where "tier 2" and "position 2" are not the
// same claim.

const keyOf = (profileId, listId) => `${profileId}::${listId}`;

export default function TierCompare({ players, listsFor, cardsFor, onBack }) {
  // Every saved list on the device, flattened into pickable options.
  const options = useMemo(
    () => players.flatMap((p) =>
      listsFor(p.id).map((list) => ({
        key: keyOf(p.id, list.id),
        label: `${p.name} — ${list.name || 'Untitled list'}`,
        owner: p.name,
        list,
      }))
    ),
    [players, listsFor]
  );

  const [aKey, setAKey] = useState(() => options[0]?.key ?? '');
  const [bKey, setBKey] = useState(() => options[1]?.key ?? options[0]?.key ?? '');

  const a = options.find((o) => o.key === aKey);
  const b = options.find((o) => o.key === bKey);
  // Two lists over different pools have no cards in common by construction, so
  // this is a mismatch to explain rather than a comparison to render.
  const mismatched = a && b && a.list.items !== b.list.items;
  const same = a && b && a.key === b.key;

  const byId = useMemo(() => {
    if (!a || mismatched) return new Map();
    return new Map(cardsFor(a.list).map((c) => [c.id, c]));
  }, [a, mismatched, cardsFor]);

  const result = useMemo(
    () => (a && b && !mismatched && !same ? compareLists(a.list, b.list) : null),
    [a, b, mismatched, same]
  );

  const pct = result?.comparisons
    ? Math.round((result.agree / result.comparisons) * 100)
    : null;

  return (
    <Screen width="md" onBack={onBack} backLabel="← Saved lists">
      <Wordmark tone="amber" subtitle="Where two lists agree, and where they don't" className="mb-8">
        Compare
      </Wordmark>

      <Card padding="lg" className="mb-6">
        <Field label="First list" htmlFor="compare-a" className="mb-4">
          <Select id="compare-a" value={aKey} onChange={(e) => setAKey(e.target.value)} className="w-full">
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Second list" htmlFor="compare-b">
          <Select id="compare-b" value={bKey} onChange={(e) => setBKey(e.target.value)} className="w-full">
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </Select>
        </Field>
      </Card>

      {same && (
        <Banner tone="info" className="mb-4">Pick two different lists.</Banner>
      )}

      {mismatched && (
        <Banner tone="warning" className="mb-4">
          ⚠️ One list ranks shows and the other ranks characters, so they have nothing in common
          to compare.
        </Banner>
      )}

      {result && result.comparisons === 0 && (
        <Banner tone="warning" className="mb-4">
          ⚠️ These two lists share {result.shared} {result.shared === 1 ? 'entry' : 'entries'} —
          not enough overlap to compare. Turn on &ldquo;Shared shows only&rdquo; at setup so both
          lists are built from the same pool.
        </Banner>
      )}

      {result && result.comparisons > 0 && (
        <>
          <Card padding="lg" className="mb-6">
            <p className="text-center font-display text-6xl font-black text-pop-amber">{pct}%</p>
            <p className="mt-1 text-center text-base text-white/60">
              agreement over {result.comparisons.toLocaleString()}{' '}
              {result.comparisons === 1 ? 'pairing' : 'pairings'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Badge tone="lime">{result.shared} in both</Badge>
              {/* Named rather than folded into the score: a show one person has
                  never seen is not a disagreement, and counting it as one would
                  make the bigger list look more wrong the more of it there was. */}
              {result.onlyA.length > 0 && (
                <Badge tone="neutral">{result.onlyA.length} only {a.owner} placed</Badge>
              )}
              {result.onlyB.length > 0 && (
                <Badge tone="neutral">{result.onlyB.length} only {b.owner} placed</Badge>
              )}
            </div>
          </Card>

          <Card title="🔥 Biggest disagreements" padding="lg">
            {result.clashes.length === 0 ? (
              <p className="text-base text-white/60">
                Nothing is out of order between these two — every pair agrees.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-white/50">
                  Sorted by how many other entries each one is ordered oppositely against — which
                  is what the score above actually counts. An entry can appear here without moving
                  itself, if enough others moved past it.
                </p>
                <ol className="flex flex-col">
                  {result.clashes.slice(0, 25).map((clash) => {
                    const card = byId.get(clash.id);
                    return (
                      <li
                        key={clash.id}
                        className="flex items-center gap-3 border-b-2 border-white/5 py-2 last:border-b-0"
                      >
                        {card?.imageUrl && (
                          <img
                            src={card.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 flex-shrink-0 rounded-sm border border-ink object-cover"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-white">
                          {card?.title ?? clash.id}
                        </span>
                        {/* A card can carry conflicts while sitting in the SAME
                            place on both lists — everything that moved past it
                            is an inversion, and conflicts blames both ends of
                            one. Printing "B vs B" there reads as a bug, so an
                            unmoved card shows its one placement instead and the
                            count carries the meaning. */}
                        <span className="flex flex-shrink-0 items-center gap-1.5 font-display text-sm font-extrabold">
                          {clash.labelA === clash.labelB ? (
                            <span className="text-white/40">
                              {clash.labelA} <span className="font-sans font-normal">both</span>
                            </span>
                          ) : (
                            <>
                              <span className="text-pop-lime">{clash.labelA}</span>
                              <span className="text-white/30">vs</span>
                              <span className="text-pop-red">{clash.labelB}</span>
                            </>
                          )}
                        </span>
                        <Badge tone="amber">×{clash.conflicts}</Badge>
                      </li>
                    );
                  })}
                </ol>
                {result.clashes.length > 25 && (
                  <p className="mt-3 text-center text-sm text-white/40">
                    …and {result.clashes.length - 25} more.
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <Button variant="neutral" size="lg" fullWidth className="mt-6" onClick={onBack}>
        ← Back to saved lists
      </Button>
    </Screen>
  );
}
