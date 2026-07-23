import { useEffect, useMemo, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer';
import { isCorrectTitleGuess, suggestTitles } from '../utils/titleMatch';

export default function AniTuneRound({
  round, players, questions, clipSeconds, onFinish, onExit,
}) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [outcome, setOutcome] = useState(null); // null | 'correct' | 'wrong' | 'skipped'
  const [scores, setScores] = useState(() => Object.fromEntries(players.map((p) => [p.id, 0])));
  const preloadRef = useRef(null);

  const question = round[index];
  // Turn-based: questions rotate through the players, so everyone gets the
  // same number of chances and scoring stays unambiguous on one device.
  const player = players[index % players.length];
  const revealed = outcome !== null;

  // Warm the next clip — metadata alone took ~2s in testing, which would
  // otherwise be dead air between questions. Delayed rather than immediate:
  // the CDN 503s under concurrent requests, and the clip being played right
  // now must win that race.
  useEffect(() => {
    const next = round[index + 1];
    if (!next) return;
    const timer = setTimeout(() => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = next.audioUrl;
      preloadRef.current = audio;
    }, 4000);
    return () => {
      clearTimeout(timer);
      if (preloadRef.current) { preloadRef.current.src = ''; preloadRef.current = null; }
    };
  }, [index, round]);

  const updateGuess = (value) => {
    setGuess(value);
    setSuggestions(suggestTitles(questions, value));
    setActiveIdx(-1);
  };

  const pickSuggestion = (title) => {
    setGuess(title);
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const submit = () => {
    if (!guess.trim() || revealed) return;
    const correct = isCorrectTitleGuess(question, guess);
    if (correct) setScores((s) => ({ ...s, [player.id]: s[player.id] + 1 }));
    setOutcome(correct ? 'correct' : 'wrong');
    setSuggestions([]);
  };

  const next = () => {
    if (index + 1 >= round.length) {
      onFinish(scores);
      return;
    }
    setIndex(index + 1);
    setGuess('');
    setSuggestions([]);
    setActiveIdx(-1);
    setOutcome(null);
  };

  const ranked = useMemo(
    () => [...players].sort((a, b) => scores[b.id] - scores[a.id]),
    [players, scores]
  );

  if (!question) return null;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-8">
      <div className="w-full max-w-2xl">
        {/* Scoreboard */}
        <div className="flex gap-2 flex-wrap justify-center mb-6">
          {ranked.map((p) => (
            <span key={p.id}
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                p.id === player.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60'
              }`}>
              {p.name} {scores[p.id]}
            </span>
          ))}
        </div>

        <p className="text-white/40 text-center text-sm mb-1">
          Question {index + 1} of {round.length}
        </p>
        <h2 className="text-3xl font-black text-white text-center mb-6">
          {player.name}&apos;s turn
        </h2>

        <ClipPlayer
          key={question.id}
          src={question.audioUrl}
          seconds={clipSeconds}
          revealed={revealed}
        />

        {!revealed && (
          <div className="mt-6">
            <input
              type="text"
              value={guess}
              onChange={(e) => updateGuess(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
                else if (e.key === 'Enter') { if (activeIdx >= 0) pickSuggestion(suggestions[activeIdx].title); else submit(); }
                else if (e.key === 'Escape') setSuggestions([]);
              }}
              placeholder="Which anime is this?"
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-pink-500 mb-3"
            />
            {/* In-flow, not absolute — an overlay here would swallow the first
                click aimed at the Guess button below. */}
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
              <button
                onClick={() => { setOutcome('skipped'); setSuggestions([]); }}
                className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                Skip
              </button>
              <button
                onClick={submit}
                disabled={!guess.trim()}
                className="flex-1 py-4 bg-gradient-to-r from-pink-600 to-purple-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors"
              >
                Guess 🎯
              </button>
            </div>
          </div>
        )}

        {revealed && (
          <div className="mt-6 text-center">
            <div className="text-5xl mb-3">
              {outcome === 'correct' ? '🎉' : outcome === 'skipped' ? '⏭️' : '❌'}
            </div>
            <p className={`text-2xl font-black mb-4 ${
              outcome === 'correct' ? 'text-green-400' : 'text-white/60'
            }`}>
              {outcome === 'correct' ? `${player.name} got it!` : outcome === 'skipped' ? 'Skipped' : 'Not quite'}
            </p>

            <div className="bg-white/5 rounded-xl p-5 mb-5">
              <p className="text-white text-2xl font-black">{question.animeTitle}</p>
              {question.displayTitle !== question.animeTitle && (
                <p className="text-white/40 text-sm mb-2">{question.displayTitle}</p>
              )}
              <p className="text-white/70 mt-2">
                {question.type === 'OP' ? 'Opening' : 'Ending'}
                {question.sequence ? ` ${question.sequence}` : ''}
                {question.songTitle ? ` — ${question.songTitle}` : ''}
              </p>
              {outcome === 'wrong' && (
                <p className="text-white/40 text-sm mt-3">You said &ldquo;{guess}&rdquo;</p>
              )}
            </div>

            <button
              onClick={next}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl transition-colors"
            >
              {index + 1 >= round.length ? 'See results →' : 'Next question →'}
            </button>
          </div>
        )}

        <button onClick={onExit} className="w-full mt-6 text-white/40 hover:text-white transition-colors text-sm">
          Quit game
        </button>
      </div>
    </div>
  );
}
