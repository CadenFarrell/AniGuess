import { useMemo, useState } from 'react';
import { compareLists } from '../tiers';
import CompareResult from './CompareResult';
import { Banner, Button, Card, Field, Screen, Select, Wordmark } from '../../../shared/ui';

// Two saved lists on THIS device, side by side. The room's version of this
// screen is RoomCompare; both draw the result with CompareResult, so what a
// clash means is decided in one place.
//
// What stays here is the picking: two <Select>s over every list every local
// profile has saved, which is a different question from "who in the room
// published one".

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
        <CompareResult result={result} ownerA={a.owner} ownerB={b.owner} byId={byId} />
      )}

      <Button variant="neutral" size="lg" fullWidth className="mt-6" onClick={onBack}>
        ← Back to saved lists
      </Button>
    </Screen>
  );
}
