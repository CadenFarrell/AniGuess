import { useState } from 'react';
import { AXES, DEFAULT_AXIS_ID, axisForPool, getAxis, isOpinion, needsEndLabels } from '../axes';
import PromptEditor from './PromptEditor';
import { Badge, Button, Card } from '../../../shared/ui';

// Picks the round's axis. Used by both local setup and the online lobby, so the
// two can't drift on which modes exist or how they're grouped.
//
// `value` and `onChange` carry an axis SPEC, not an id: a string for a built-in,
// the stored prompt object for a custom one. See getAxis — a custom prompt has
// to travel with its definition, because no other device can look it up.
//
// Two boxes, split by where the answer key comes from, which is the thing a
// table is actually choosing between. A prompt someone wrote lives in the
// Opinion box beside the ready-made ones rather than in a box of its own,
// because that is what it IS: with no number on a card to sort by, there is
// nothing to fact-check it against, so customAxis hands back kind: 'opinion' and
// the subject's own board is the answer key. Giving it a third box implied a
// distinction the game does not make.
//
// Facts stays separate for the mirror-image reason — those are the only modes
// with a right answer, and nothing a player writes can ever join them.
//
// Both boxes fold and both start closed. The header is what makes that safe: it
// names the pick without being opened. Only one mode is selected at a time, so
// only one header can name it; the other says so plainly rather than showing a
// mode that looks chosen but isn't.
const OPINION_HINT =
  'One player is the subject. Everyone ranks as they would — their own board is the answer.';
const FACT_HINT =
  'One right answer, from AniList. Needs a profile imported since stats were added.';

const OPINION_AXES = AXES.filter((a) => a.kind === 'opinion');
const FACT_AXES = AXES.filter((a) => a.kind === 'fact');

const inPool = (items) => (a) => a.items === items;

// `opinionOnly` hides the Facts box, for the tier-list formats. A fact axis
// drops every item whose stat is missing (see utils/deck.js), which on a profile
// imported before the stats existed would quietly tier a fraction of the list
// with nothing on screen to say so — and hand-sorting two hundred shows by
// their AniList score is not a thing anyone wants to do anyway. The pool a
// tier list draws from is therefore always the unfiltered opinion one.
// `minCount` is how many cards this screen actually needs, and it is a prop
// rather than a constant because the two halves of the game disagree: a round
// has to fill ten slots, a tier list needs two. Hardcoding ten reddened the
// badge on a perfectly playable tier list.
export default function AxisPicker({
  value, onChange, disabled = false, counts, opinionOnly = false, minCount = 10,
  prompts = [], onSavePrompt, onDeletePrompt,
}) {
  const selected = getAxis(value);
  // null = closed, {} = writing a new one, a stored prompt = editing that one.
  const [editing, setEditing] = useState(null);

  // WHICH TAB IS SHOWING IS DERIVED FROM THE SELECTION, not held in useState,
  // and that is the whole trick. There is no second copy of "which pool am I in"
  // to fall out of step, and three things come free: opening the picker with
  // `fight` already saved shows the Characters tab; saving a character prompt
  // while looking at Shows switches the tab, because handleSave already calls
  // onChange; and nothing new has to be remembered in prefs.js, since the saved
  // axisId already implies the pool.
  const items = selected.items;
  const opinionAxes = OPINION_AXES.filter(inPool(items));
  const factAxes = FACT_AXES.filter(inPool(items));
  const myPrompts = prompts.filter((p) => (p.items === 'characters' ? 'characters' : 'shows') === items);

  // Flipping the tab has to answer "you were on this mode, now you are in that
  // pool — which mode are you on?". axisForPool keeps the kind, so someone on
  // "Release date" lands on the character fact mode rather than an opinion one.
  const handlePool = (next) => {
    if (next !== items) onChange(axisForPool(value, next));
  };

  const handleSave = (draft) => {
    const saved = onSavePrompt(draft);
    // Selecting what you just wrote — nobody writes a prompt they did not intend
    // to play, and the alternative is saving it and then hunting for it in the list.
    if (saved) onChange(saved);
  };

  const handleDelete = (id) => {
    onDeletePrompt(id);
    // Falls back rather than leaving both headers reading "none selected", which
    // is what deleting the mode you had chosen would otherwise do. Through
    // axisForPool so it lands in the pool you are looking at — DEFAULT_AXIS_ID is
    // a shows mode, so deleting a character prompt would otherwise flip the tab.
    if (selected.id === id) onChange(axisForPool(DEFAULT_AXIS_ID, items));
  };

  return (
    <div className="mb-6">
      {/* Above both boxes, because it governs both. Ranking your shows should
          never be offered "Would win → Would lose"; before this was a control,
          the pool was a hidden property of whichever mode you happened to pick
          and half of every list was irrelevant. */}
      <div className="mb-4 flex gap-2" role="group" aria-label="What to rank">
        <PoolTab
          active={items === 'shows'}
          disabled={disabled}
          onClick={() => handlePool('shows')}
        >
          📺 Shows
        </PoolTab>
        <PoolTab
          active={items === 'characters'}
          disabled={disabled}
          onClick={() => handlePool('characters')}
        >
          👤 Characters
        </PoolTab>
      </div>

      <ModeBox
        title="🎭 Opinion"
        // One check for the whole box, precisely because a hydrated custom
        // prompt IS an opinion axis — the same fact that puts the two halves
        // together in here.
        selectedLabel={isOpinion(selected) ? selected.label : null}
        // Counted from the filtered lists, never hardcoded: the Facts box holds
        // four show modes but only one character mode, so a fixed number lies on
        // one of the two tabs.
        emptyText={`None selected · ${myPrompts.length + opinionAxes.length} modes`}
      >
        <p className="mb-4 text-sm text-white/50">{OPINION_HINT}</p>

        {myPrompts.length > 0 && (
          <>
            <SectionLabel>Yours</SectionLabel>
            <div className="mb-4 flex flex-col gap-2">
              {myPrompts.map((prompt) => {
                const axis = getAxis(prompt);
                return (
                  <div key={axis.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <AxisButton
                        axis={axis}
                        active={axis.id === selected.id}
                        disabled={disabled}
                        count={counts?.[axis.id]}
                        minCount={minCount}
                        onClick={() => onChange(prompt)}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Edit ${axis.label}`}
                      onClick={() => setEditing(prompt)}
                      className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                        text-lg hover:bg-white/10 disabled:opacity-30"
                    >
                      ✏️
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <SectionLabel>Recommended</SectionLabel>
        <div className="mb-4 flex flex-col gap-2">
          {opinionAxes.map((axis) => (
            <AxisButton
              key={axis.id}
              axis={axis}
              active={axis.id === selected.id}
              disabled={disabled}
              count={counts?.[axis.id]}
              minCount={minCount}
              onClick={() => onChange(axis.id)}
            />
          ))}
        </div>

        {/* Says what a custom prompt is exactly once — the first time you open
            this box, when the button below it is the only thing you have not
            seen before. */}
        {myPrompts.length === 0 && (
          <p className="mb-3 text-sm text-white/50">
            Or rank by anything you can finish &ldquo;rank these {items === 'characters' ? 'characters' : 'shows'} by&hellip;&rdquo; with.
          </p>
        )}
        {/* Seeded with the tab you are on, so writing a prompt from Characters
            does not save a shows prompt that then vanishes from the list you are
            looking at. PromptEditor reads `prompt?.items ?? 'shows'` and still
            treats this as new, because there is no id. */}
        <Button
          variant="neutral"
          size="md"
          fullWidth
          disabled={disabled}
          onClick={() => setEditing({ items })}
        >
          ✏️ {myPrompts.length > 0 ? 'New prompt' : 'Write your own prompt'}
        </Button>
      </ModeBox>

      {!opinionOnly && (
        <ModeBox
          title="📊 Facts"
          selectedLabel={factAxes.find((a) => a.id === selected.id)?.label ?? null}
          emptyText={`None selected · ${factAxes.length} ${factAxes.length === 1 ? 'mode' : 'modes'}`}
        >
          <p className="mb-3 text-sm text-white/50">{FACT_HINT}</p>
          <div className="flex flex-col gap-2">
            {factAxes.map((axis) => (
              <AxisButton
                key={axis.id}
                axis={axis}
                active={axis.id === selected.id}
                disabled={disabled}
                count={counts?.[axis.id]}
                minCount={minCount}
                onClick={() => onChange(axis.id)}
              />
            ))}
          </div>
        </ModeBox>
      )}

      {editing && (
        <PromptEditor
          prompt={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// One half of the Shows/Characters switch. Two buttons rather than a Checkbox or
// a Select because the choice is between two peers and both should be readable
// without opening anything — the same reason AxisButton is a button and not a
// radio.
function PoolTab({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`focus-pop flex-1 rounded-pop-sm border-2 px-3 py-2.5 text-center
        font-display text-base font-extrabold transition-colors disabled:opacity-40
        ${active
          ? 'border-pop-amber bg-pop-amber/20 text-white'
          : 'border-white/10 bg-surface-2/40 text-white/50 hover:border-white/30'}`}
    >
      {children}
    </button>
  );
}

// The divider between your prompts and the ready-made ones. A plain <p>, not
// Field.jsx's Label: that renders a <label>, which has no control to point at.
function SectionLabel({ children }) {
  return (
    <p className="mb-2 font-display text-xs font-extrabold uppercase tracking-widest text-white/50">
      {children}
    </p>
  );
}

// One collapsible box of modes, and the reason both can sit closed without
// hiding what is in play.
//
// `selectedLabel` is the pick if it belongs to this box and null otherwise —
// resolved by the caller, because only it knows which modes are in here. The box
// holding the pick names it beside an amber dot; the other says so in muted text
// and counts what is behind the fold. Nothing ever renders a mode that reads as
// chosen when it is not the one that will be played.
//
// Chevron and disclosure treatment from AniListImport's "Advanced".
function ModeBox({ title, selectedLabel, emptyText, children }) {
  const [open, setOpen] = useState(false);

  return (
    <Card title={title} padding="lg" className="mb-4 last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-pop -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-pop-sm
          px-2 py-1.5 text-left transition-colors hover:bg-white/5"
      >
        <span className="flex-shrink-0 text-sm text-white/40">{open ? '▼' : '▶'}</span>
        {selectedLabel ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-hidden="true" className="flex-shrink-0 text-xs text-pop-amber">●</span>
            <span className="min-w-0 truncate font-display text-base font-extrabold text-white">
              {selectedLabel}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-base text-white/40">{emptyText}</span>
        )}
      </button>

      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}

// One selectable mode. Shared by your prompts and the built-in lists so a prompt
// you wrote reads and behaves exactly like one that shipped.
function AxisButton({ axis, active, disabled, count, minCount, onClick }) {
  // How many cards this axis could actually deal. Undefined until the caller has
  // a roster to count against; 0 is the ordinary result of a fact axis on a
  // profile that predates the stats, and saying so here beats a dead Start button.
  const short = count != null && count < minCount;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`focus-pop flex w-full items-center gap-3 rounded-pop-sm border-2 px-3 py-2.5
        text-left transition-colors disabled:opacity-40
        ${active
          ? 'border-pop-amber bg-pop-amber/20'
          : 'border-white/10 bg-surface-2/40 hover:border-white/30'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-base font-extrabold text-white">
          {axis.label}
        </span>
        {/* Only where it adds something. This line used to read "Shows · #1 =
            BEST" under every mode: the pool half is now the tab above, and the
            rest was a formula rather than a sentence — printed even under "Best
            → Worst", whose label already says which end is the top. See
            needsEndLabels, which is why that rule lives in axes.js rather than
            being sniffed out of the label here. */}
        {needsEndLabels(axis) && (
          <span className="block truncate text-sm text-white/50">
            {axis.topLabel} → {axis.bottomLabel}
          </span>
        )}
      </span>
      {count != null && (
        <Badge tone={short ? 'red' : 'neutral'}>{count}</Badge>
      )}
    </button>
  );
}
