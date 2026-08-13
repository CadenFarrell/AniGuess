import { Badge, Card } from '../../../shared/ui';

// The result of one compareLists call, drawn.
//
// Extracted from TierCompare when the online room grew its own compare screen,
// rather than copied into it. The reasoning below is the part worth not
// duplicating: two screens that each decide what a clash MEANS will drift, and
// the drift is invisible because both keep rendering something plausible. Same
// argument shared/ui/Combobox makes, and AniGuess spent a release proving it.
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

// Enough to argue about without turning the card into a scrollable wall. The
// count below says what was left out, so a capped list never reads as the whole
// disagreement.
const MAX_CLASHES = 25;

export default function CompareResult({ result, ownerA, ownerB, byId }) {
  const pct = result?.comparisons
    ? Math.round((result.agree / result.comparisons) * 100)
    : null;

  return (
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
            <Badge tone="neutral">{result.onlyA.length} only {ownerA} placed</Badge>
          )}
          {result.onlyB.length > 0 && (
            <Badge tone="neutral">{result.onlyB.length} only {ownerB} placed</Badge>
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
              {result.clashes.slice(0, MAX_CLASHES).map((clash) => {
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
            {result.clashes.length > MAX_CLASHES && (
              <p className="mt-3 text-center text-sm text-white/40">
                …and {result.clashes.length - MAX_CLASHES} more.
              </p>
            )}
          </>
        )}
      </Card>
    </>
  );
}
