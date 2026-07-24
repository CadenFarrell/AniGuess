import { useState } from 'react';
import { suggestTitles } from '../utils/titleMatch';

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
      <input
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
        autoFocus
        autoComplete="off"
        className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-pink-500 mb-3"
      />

      {/* In-flow, not absolute — an overlay here would swallow the first
          click aimed at the submit button below. */}
      {suggestions.length > 0 && (
        <div className="w-full bg-gray-900 border border-white/20 rounded-xl overflow-hidden mb-3">
          {suggestions.map((s, i) => (
            <div key={s.title} onMouseDown={() => pickSuggestion(s.title)}
              className={`px-4 py-2 cursor-pointer ${i === activeIdx ? 'bg-pink-600/30' : 'hover:bg-white/10'}`}>
              <p className="text-white text-sm font-semibold">{s.title}</p>
              {s.alt && s.alt !== s.title && <p className="text-white/40 text-xs">{s.alt}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {onSkip && (
          <button
            onClick={() => { setSuggestions([]); onSkip(); }}
            className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            {skipLabel || 'Skip'}
          </button>
        )}
        <button
          onClick={submit}
          disabled={!guess.trim()}
          className="flex-1 py-4 bg-gradient-to-r from-pink-600 to-purple-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
