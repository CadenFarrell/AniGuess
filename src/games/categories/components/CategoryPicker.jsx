import { useMemo, useState } from 'react';
import { Button, Card, Combobox } from '../../../shared/ui';
import { MAX_LABEL_LEN, normalizeCustomCategory } from '../categories';

// How many clauses the cold start puts on screen. A search box with nothing
// typed shows nothing, and "invent a category" is a much harder first move than
// "react to one" — so the empty state is a short strip to push off. Small on
// purpose: it is a prompt, not the list, and every other clause is one keystroke
// away.
const BROWSE_SIZE = 6;

/**
 * CHOSEN MODE: one player commits the clause only they will know.
 *
 * ONE BOX, TWO WAYS IN, ONE COMMIT. Type a clause of your own, or type towards
 * one of the built-ins and take it — and they leave through the same button,
 * because the thing being committed is the same kind of thing either way.
 * rules.js never learns which it was (toSpec accepts an id or a whole
 * definition, exactly as it does for a dealt one), so nothing downstream
 * branches.
 *
 * WHICH IT IS, IS DERIVED RATHER THAN REMEMBERED. If the text in the box is
 * exactly a built-in's label, it travels as that built-in's id; anything else
 * travels as a written clause. That removes the `choice`/`draft` pair this
 * screen used to hold and the "which did they mean" question that came with it
 * — two pieces of state for one decision is how a picker ends up committing the
 * thing the player had typed over.
 *
 * A TYPEAHEAD RATHER THAN A SCROLLING WALL. It was a `max-h-72` list of two
 * dozen ungrouped buttons inside a page that already scrolled, with the confirm
 * button below it — which is the exact problem `Combobox` exists for, and which
 * AniGuess, AniTune and AniWave all solved by using it. Ranking stays here, as
 * that component's header requires: a clause is short and unstructured, so
 * "starts with" then "contains" is the whole of it.
 *
 * SELECT THEN CONFIRM, rather than tapping a suggestion to commit it. This is
 * the single irreversible tap of the whole round — there is no unpicking a
 * clause once the table starts answering against it — so a one-tap commit on a
 * phone is a misfire waiting to happen.
 *
 * A CLAUSE WRITTEN HERE IS NOT SAVED TO THIS DEVICE'S LIST, deliberately.
 * CategoryEditor on the setup screen is where you build a collection you keep;
 * this is one round, mid-game, and quietly growing somebody's saved list every
 * time they improvise would make that list unusable within a session or two.
 * Anything worth keeping gets written once in the editor and then appears at
 * the top of `suggestions` forever.
 */
export default function CategoryPicker({
  suggestions = [], noun = 'card', onPick, busy = false,
}) {
  const [draft, setDraft] = useState('');
  const query = draft.trim().toLowerCase();

  const ranked = useMemo(() => {
    if (!query) return [];
    const starts = [];
    const contains = [];
    for (const c of suggestions) {
      const label = c.label.toLowerCase();
      // An exact match is a decision already made, and offering it back is a
      // dropdown containing the line you are looking at — which is what taking
      // one off the browse strip below produced, since filling the box counts
      // as typing.
      if (label === query) continue;
      if (label.startsWith(query)) starts.push(c);
      else if (label.includes(query)) contains.push(c);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [suggestions, query]);

  // Exact-label match against the WHOLE list rather than the ranked slice: a
  // player who typed a clause out in full should still get the built-in, even
  // if it ranked below the cut.
  const exact = suggestions.find((c) => c.label.toLowerCase() === query) ?? null;
  const written = normalizeCustomCategory({ label: draft });
  const spec = query ? (exact ?? written) : null;

  const commit = () => {
    if (!spec || busy) return;
    // A built-in travels as its id and a written one as its whole definition —
    // the asymmetry getCategory resolves, and the reason is that every device
    // ships every built-in while a written one has been seen by exactly one.
    onPick(exact && exact.id && !exact.custom ? exact.id : spec);
  };

  return (
    <>
      <Card title="Your category" padding="md" className="mb-6">
        <Combobox
          value={draft}
          onChange={setDraft}
          suggestions={ranked}
          onSelect={(c) => setDraft(c.label)}
          onSubmit={commit}
          optionKey={(c) => c.id}
          renderOption={(c) => (
            <span className="min-w-0 flex-1 truncate text-base text-white">
              {c.custom && <span className="mr-2 text-pop-purple">✍️</span>}
              {c.label}
            </span>
          )}
          maxLength={MAX_LABEL_LEN}
          ariaLabel="Your category — type your own or search the list"
          placeholder={noun === 'show' ? 'e.g. Has a terrible dub' : 'e.g. Wears a hat'}
          autoFocus
        />
        {/* The cold start. Only while the box is empty, because once somebody is
            typing the dropdown is a better answer to the same need. */}
        {!query && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.slice(0, BROWSE_SIZE).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setDraft(c.label)}
                className="focus-pop rounded-pop-sm border-2 border-white/10 bg-white/5 px-3 py-2
                  text-left text-base text-white/70 transition-colors hover:text-white"
              >
                {c.custom && <span className="mr-1.5 text-pop-purple">✍️</span>}
                {c.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-white/40">
          Anything the table can rule on — nothing here is checked against a database, so a
          clause no anime site could ever know is exactly the point.
        </p>
      </Card>

      {/* Commits the NORMALIZED value, never the raw draft: a 60-character draft
          is stored as 48, so a button promising the draft would promise a clause
          the game will not play. Same discipline CategoryEditor keeps — and it
          replaces a third card that did nothing but echo the same string. */}
      <Button variant="success" size="lg" fullWidth disabled={!spec || busy} onClick={commit}>
        {busy ? 'Saving…' : (spec ? `🔒 Lock in “${spec.label}”` : '🔒 Lock it in')}
      </Button>
    </>
  );
}
