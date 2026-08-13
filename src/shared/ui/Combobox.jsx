import { useId, useState } from 'react';
import { Input } from './Field';

// The typeahead shell: a text box with a ranked suggestion list under it.
//
// Extracted because this pattern had been written three times by hand
// (aniguess's GameScreen and OnlineGameScreen, anitune's GuessInput) and the
// copies drifted — the online AniGuess one lost arrow-key navigation somewhere
// along the way, so the same game answered to two different keyboards depending
// on how you were playing it. Same reasoning as shared/hooks/useRoomCore.js.
//
// All three call sites are on this component now. That is worth stating because
// it was not true for a release: this header claimed the extraction was done
// while both AniGuess screens were still hand-rolled, so the drift it describes
// in the past tense was live the whole time — and a comment asserting a
// migration that never happened is worse than the missing migration, because it
// stops anyone looking. If a fourth typeahead appears, convert it here rather
// than adding a fourth copy.
//
// Ranking stays with the caller, deliberately: AniGuess ranks characters,
// AniTune ranks titles, and the two want different match tiers. What is
// genuinely shared is this shell — keyboard handling, the highlight, and the
// ARIA below.
export default function Combobox({
  value,
  onChange,
  suggestions = [],
  onSelect,
  onSubmit,
  renderOption,
  optionKey = (o, i) => i,
  placeholder,
  maxLength,
  ariaLabel,
  autoFocus = false,
  // 'password' for pass-and-play, where the rest of the table is looking at the
  // same screen. Callers that mask should also pass an empty `suggestions`: a
  // dropdown of candidate answers beside a hidden field leaks the very thing the
  // masking is hiding.
  type = 'text',
  className = '',
}) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  // Escape hides the current list; typing brings it back. Kept as state rather
  // than by clearing `suggestions` (which the caller owns) so the caller never
  // has to know the list was dismissed.
  const open = suggestions.length > 0 && !dismissed;
  const listId = useId();
  const optionId = (i) => `${listId}-opt-${i}`;

  const change = (text) => {
    setActiveIdx(-1);
    setDismissed(false);
    onChange?.(text);
  };

  const pick = (option) => {
    setActiveIdx(-1);
    setDismissed(true);
    onSelect?.(option);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDismissed(false);
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0) pick(suggestions[activeIdx]);
      else onSubmit?.();
    } else if (e.key === 'Escape') {
      setDismissed(true);
      setActiveIdx(-1);
    }
  };

  return (
    <div className={className}>
      <Input
        type={type}
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        // The browser's own autofill dropdown would render on top of ours.
        autoComplete="off"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIdx >= 0 ? optionId(activeIdx) : undefined}
        className="text-lg"
      />
      {/* In-flow (not absolute) so the list never overlaps the buttons below —
          otherwise a click meant for the submit button lands on a suggestion
          and only the second click submits. */}
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="mt-3 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-pop
            border-2 border-white/15 bg-surface"
        >
          {suggestions.map((option, i) => (
            <div
              key={optionKey(option, i)}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIdx}
              // onMouseDown, not onClick: the input blurs first, and a list that
              // unmounts on blur would swallow the click entirely.
              onMouseDown={(e) => { e.preventDefault(); pick(option); }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2
                ${i === activeIdx ? 'bg-pop-pink/30' : 'hover:bg-white/10'}`}
            >
              {renderOption(option)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
