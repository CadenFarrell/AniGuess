import { useState } from 'react';
import { suggestTitles } from '../utils/titleMatch';
import { Button, Combobox } from '../../../shared/ui';

// The title entry field, shared by both modes. Owns its own draft text so the
// round state only ever sees a submitted answer.
//
// The typeahead shell is shared/ui/Combobox — keyboard handling, the highlight,
// and the ARIA combobox roles this file used to be missing. Combobox's own
// header named this component as one of the three hand-rolled copies it was
// extracted to replace; this was the first converted and AniGuess's two followed
// later, so for a release the arcade did answer to two different keyboards
// depending on which game you were in. Ranking stays here, as it does for
// AniGuess: this one ranks titles.
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
  disabled = false,
  onSubmit,
  onSkip,
}) {
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const updateGuess = (value) => {
    setGuess(value);
    setSuggestions(masked ? [] : suggestTitles(questions, value));
  };

  const submit = () => {
    if (!guess.trim() || disabled) return;
    setSuggestions([]);
    onSubmit(guess);
  };

  return (
    <div>
      <Combobox
        value={guess}
        onChange={updateGuess}
        suggestions={suggestions}
        onSelect={(s) => { setGuess(s.title); setSuggestions([]); }}
        onSubmit={submit}
        optionKey={(s) => s.title}
        renderOption={(s) => (
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">{s.title}</p>
            {s.alt && s.alt !== s.title && (
              <p className="truncate text-sm text-white/40">{s.alt}</p>
            )}
          </div>
        )}
        type={masked ? 'password' : 'text'}
        placeholder={placeholder}
        ariaLabel={placeholder}
        autoFocus
        className="mb-3"
      />

      <div className="flex gap-3">
        {onSkip && (
          <Button
            variant="neutral"
            size="lg"
            disabled={disabled}
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
          disabled={disabled || !guess.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
