import { useState } from 'react';
import { suggestTitles } from '../utils/titleMatch';
import { Button, Input } from '../../../shared/ui';

// The title entry field, shared by both modes. Owns its own draft text so the
// round state only ever sees a submitted answer.
//
// `masked` is for pass-and-play, where the rest of the table is looking at the
// same screen: the text is hidden AND the suggestion list is suppressed, since a
// dropdown of candidate titles next to a hidden field would leak the answer to
// everyone watching. isCorrectTitleGuess is generous enough (4+ character
// fragments, token subsets, either the list title or the romaji name) that
// typing without autocomplete still works.
export default function GuessInput({
  questions,
  masked = false,
  placeholder = 'Which anime is this?',
  submitLabel = 'Guess 🎯',
  skipLabel,
  onSubmit,
  onSkip,
}) {
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const updateGuess = (value) => {
    setGuess(value);
    setSuggestions(masked ? [] : suggestTitles(questions, value));
    setActiveIdx(-1);
  };

  const pickSuggestion = (title) => {
    setGuess(title);
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const submit = () => {
    if (!guess.trim()) return;
    setSuggestions([]);
    onSubmit(guess);
  };

  return (
    <div>
      <Input
        type={masked ? 'password' : 'text'}
        value={guess}
        onChange={(e) => updateGuess(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
          else if (e.key === 'Enter') { if (activeIdx >= 0) pickSuggestion(suggestions[activeIdx].title); else submit(); }
          else if (e.key === 'Escape') setSuggestions([]);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus
        autoComplete="off"
        className="mb-3 text-lg"
      />

      {/* In-flow, not absolute — an overlay here would swallow the first
          click aimed at the submit button below. */}
      {suggestions.length > 0 && (
        <div className="mb-3 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
          {suggestions.map((s, i) => (
            <div
              key={s.title}
              onMouseDown={() => pickSuggestion(s.title)}
              className={`cursor-pointer px-4 py-2 ${
                i === activeIdx ? 'bg-pop-pink/30' : 'hover:bg-white/10'
              }`}
            >
              <p className="text-base font-bold text-white">{s.title}</p>
              {s.alt && s.alt !== s.title && <p className="text-sm text-white/40">{s.alt}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {onSkip && (
          <Button
            variant="neutral"
            size="lg"
            onClick={() => { setSuggestions([]); onSkip(); }}
          >
            {skipLabel || 'Skip'}
          </Button>
        )}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={submit}
          disabled={!guess.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
