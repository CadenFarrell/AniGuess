import { useState, useEffect, useRef } from 'react';
import TurnTracker from './TurnTracker';

export default function GameScreen({
  guesser,
  character,
  players,
  lockedPositions,
  questionLog,
  turnCount,
  hasPeeked,
  onPeek,
  onTurnComplete,
  onCorrectGuess,
  onWrongGuess,
  timerEnabled,
  timerSeconds,
  sharedShowsOnly = true,
}) {
  const [question, setQuestion] = useState('');
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const allChars = guesser.animeList.flatMap(a => a.characters.map(c => ({ name: c.name, series: a.title, imageUrl: c.imageUrl })));
  const [mode, setMode] = useState('choose'); // choose | question | guess
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [showPeekModal, setShowPeekModal] = useState(false);
  const [wrongMessage, setWrongMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerActive, setTimerActive] = useState(timerEnabled);
  const timerRef = useRef(null);

  const peekList = sharedShowsOnly
    ? guesser.animeList.filter(anime => players.some(p => p.id !== guesser.id && p.animeList.some(a => a.title === anime.title)))
    : guesser.animeList;

  // Reset state when guesser changes (setState during render — React recommended pattern)
  const [prevGuesserID, setPrevGuesserID] = useState(guesser.id);
  if (prevGuesserID !== guesser.id) {
    setPrevGuesserID(guesser.id);
    setQuestion('');
    setGuess('');
    setMode('choose');
    setWaitingForAnswer(false);
    setPendingQuestion('');
    setWrongMessage('');
    setTimeLeft(timerSeconds);
    setTimerActive(timerEnabled); // Start timer at the beginning of each turn
  }

  // Timer
  useEffect(() => {
    if (!timerEnabled) return;
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      setTimeout(() => {
        setTimerActive(false);
        setWaitingForAnswer(false);
        const logEntry = { type: 'timer', text: "⏱️ Time's up!" };
        onTurnComplete(logEntry);
      }, 0);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerActive, timeLeft, timerEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitQuestion = () => {
    if (!question.trim()) return;
    // Stop the timer when the question is asked
    clearTimeout(timerRef.current);
    setTimerActive(false);
    setPendingQuestion(question.trim());
    setQuestion('');
    setWaitingForAnswer(true);
  };

  const answerQuestion = (answer) => {
    clearTimeout(timerRef.current);
    setTimerActive(false);
    setWaitingForAnswer(false);
    const logEntry = { type: 'question', text: pendingQuestion, answer };
    setPendingQuestion('');
    onTurnComplete(logEntry);
  };

  /**
   * Check whether a guess matches the character.
   * Accepts the canonical name OR any nickname (all case-insensitive, substring match).
   */
  const isCorrectGuess = (raw) => {
    const g = raw.trim().toLowerCase();
    if (character.name.toLowerCase().includes(g)) return true;
    if (character.nicknames?.some((n) => n.toLowerCase().includes(g))) return true;
    return false;
  };

  const updateGuess = (val) => {
    setGuess(val);
    setActiveIdx(-1);
    if (val.trim().length < 1) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(allChars.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5));
  };

  const pickSuggestion = (name) => {
    setGuess(name);
    setSuggestions([]);
    setActiveIdx(-1);
  };

  const submitGuess = () => {
    setSuggestions([]);
    if (!guess.trim()) return;
    const correct = isCorrectGuess(guess);
    const logEntry = { type: 'guess', text: guess.trim(), correct };

    if (correct) {
      onCorrectGuess(logEntry);
    } else {
      setWrongMessage("Not quite — your turn is over!");
      setTimeout(() => setWrongMessage(''), 2500);
      setGuess('');
      onWrongGuess(logEntry);
    }
  };

  const handlePeek = () => {
    setShowPeekModal(true);
    onPeek();
  };

  const timerColor = timeLeft > 10 ? 'text-green-400' : timeLeft > 5 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto">

      <TurnTracker
        players={players}
        currentPlayerId={guesser.id}
        lockedPositions={lockedPositions}
      />

      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black text-white">
          🎮 {guesser.name}'s Turn
        </h2>
        <p className="text-white/50 text-base mt-1">Turn {turnCount + 1} · Ask a question or submit a guess</p>
      </div>

      {/* Timer */}
      {timerEnabled && timerActive && (
        <div className={`text-center text-5xl font-black mb-4 ${timerColor}`}>
          ⏱️ {timeLeft}s
        </div>
      )}

      {/* Peek */}
      <button
        onClick={handlePeek}
        disabled={hasPeeked}
        className={`w-full py-3 mb-5 rounded-xl font-bold text-base transition-all
          ${hasPeeked ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-purple-900/50 hover:bg-purple-900 text-purple-300 border border-purple-700'}`}
      >
        {hasPeeked ? '📋 Already peeked this round' : '📋 Peek at my anime list (once per round)'}
      </button>

      {/* Action Area */}
      {mode === 'choose' && !waitingForAnswer && (
        <div className="flex gap-4 mb-5">
          <button
            onClick={() => setMode('question')}
            className="flex-1 py-5 bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-black text-lg rounded-xl border border-blue-600 transition-all"
          >
            ❓ Ask a Question
          </button>
          <button
            onClick={() => setMode('guess')}
            className="flex-1 py-5 bg-gradient-to-br from-pink-700 to-purple-900 hover:from-pink-600 hover:to-purple-800 text-white font-black text-lg rounded-xl border border-pink-600 transition-all"
          >
            🎯 Submit Guess
          </button>
        </div>
      )}

      {mode === 'question' && !waitingForAnswer && (
        <div className="mb-5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && question.trim() && submitQuestion()}
            placeholder="Type your yes/no question..."
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-blue-500 mb-3"
          />
          <div className="flex gap-3">
            <button
              onClick={() => { setMode('choose'); setQuestion(''); }}
              className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-base"
            >
              ← Back
            </button>
            <button
              onClick={submitQuestion}
              disabled={!question.trim()}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Ask ❓
            </button>
          </div>
        </div>
      )}

      {mode === 'guess' && (
        <div className="mb-5">
          <div className="relative">
          <input
            type="text"
            value={guess}
            onChange={(e) => updateGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
              else if (e.key === 'Enter') { if (activeIdx >= 0) pickSuggestion(suggestions[activeIdx].name); else if (guess.trim()) submitGuess(); }
              else if (e.key === 'Escape') setSuggestions([]);
            }}
            placeholder="Type your guess..."
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-pink-500 mb-3"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-gray-900 border border-white/20 rounded-xl overflow-hidden mb-3">
              {suggestions.map((s, i) => (
                <div key={i} onMouseDown={() => pickSuggestion(s.name)}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${ i === activeIdx ? 'bg-pink-600/30' : 'hover:bg-white/10' }`}>
                  {s.imageUrl && <img src={s.imageUrl} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                  <div>
                    <p className="text-white text-sm font-semibold">{s.name}</p>
                    <p className="text-white/40 text-xs">{s.series}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setMode('choose'); setGuess(''); setSuggestions([]); }}
              className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-base"
            >
              ← Back
            </button>
            <button
              onClick={submitGuess}
              disabled={!guess.trim()}
              className="flex-1 py-4 bg-gradient-to-r from-pink-600 to-purple-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Guess 🎯
            </button>
          </div>
          {wrongMessage && (
            <p className="text-red-400 text-center mt-3 font-bold text-lg">{wrongMessage}</p>
          )}
        </div>
      )}

      {/* Yes / No buttons */}
      {waitingForAnswer && (
        <div className="mb-5">
          <p className="text-white/60 text-center text-base mb-4">
            ❓ <span className="text-white font-bold text-lg">{pendingQuestion}</span>
          </p>
          <p className="text-white/40 text-center text-sm mb-4">Everyone else — answer this question</p>
          <div className="flex gap-4">
            <button
              onClick={() => answerQuestion('Yes')}
              className="flex-1 py-6 text-3xl font-black bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white rounded-xl transition-all"
            >
              ✅ Yes
            </button>
            <button
              onClick={() => answerQuestion('No')}
              className="flex-1 py-6 text-3xl font-black bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white rounded-xl transition-all"
            >
              ❌ No
            </button>
          </div>
        </div>
      )}

      {/* Question Log */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-h-72 overflow-y-auto">
        <h4 className="text-white/60 text-sm font-bold uppercase tracking-wider mb-3">
          {guesser.name}'s Question Log
        </h4>
        {questionLog.length === 0 ? (
          <p className="text-white/30 text-base text-center">No questions yet</p>
        ) : (
          questionLog.map((entry, i) => (
            <div key={i} className="text-base py-2 border-b border-white/5 last:border-0">
              {entry.type === 'question' && (
                <span className="text-white/70">
                  ❓ {entry.text}
                  {entry.answer && (
                    <strong className={entry.answer === 'Yes' ? 'text-green-400' : 'text-red-400'}>
                      {' '}— {entry.answer}
                    </strong>
                  )}
                </span>
              )}
              {entry.type === 'guess' && (
                <span className={entry.correct ? 'text-green-400' : 'text-red-400'}>
                  🎯 {entry.text} {entry.correct ? '✅' : '❌'}
                </span>
              )}
              {entry.type === 'timer' && (
                <span className="text-orange-400">{entry.text}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Peek Modal */}
      {showPeekModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-lg w-full max-h-[32rem] overflow-y-auto">
            <h3 className="text-white font-black text-2xl mb-1">📋 Your Anime List</h3>
            <p className="text-white/50 text-base mb-5">Titles only — no characters!</p>
            {peekList.length === 0 ? (
              <p className="text-white/50 text-lg">No shared anime found.</p>
            ) : (
              <ul className="space-y-2">
                {peekList.map((anime) => (
                  <li key={anime.id} className="text-white/80 text-lg py-2 border-b border-white/10">
                    {anime.title}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => setShowPeekModal(false)}
              className="mt-5 w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-xl transition-colors"
            >
              Got it — close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
