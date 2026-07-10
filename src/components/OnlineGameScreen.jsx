import { useState, useMemo } from 'react';
import TurnTracker from './TurnTracker';
import { normalizeTitle } from '../utils/ranking';

// The active guesser's device. Deliberately never receives the assigned
// character — only raw question/guess text ever leaves this device, sent via
// onSubmitQuestion/onSubmitGuess for a non-guesser device to resolve (see
// useRoom.js's submitPendingAction / OnlineAnswererView's resolvePendingAction).
export default function OnlineGameScreen({
  guesser,
  players,
  lockedPositions,
  questionLog,
  turnCount,
  hasPeeked,
  onPeek,
  onSubmitQuestion,
  onSubmitGuess,
  pendingAction,
  sharedShowsOnly = true,
}) {
  const [mode, setMode] = useState('choose'); // choose | question | guess
  const [question, setQuestion] = useState('');
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showPeekModal, setShowPeekModal] = useState(false);

  const allChars = useMemo(
    () => guesser.animeList.flatMap((a) => a.characters.map((c) => ({ name: c.name, series: a.title, imageUrl: c.imageUrl }))),
    [guesser.animeList]
  );

  const peekList = useMemo(
    () => sharedShowsOnly
      ? guesser.animeList.filter((anime) => players.some((p) => p.id !== guesser.id && p.animeList.some((a) => normalizeTitle(a.title) === normalizeTitle(anime.title))))
      : guesser.animeList,
    [sharedShowsOnly, guesser, players]
  );

  const waiting = pendingAction && pendingAction.askedBy === guesser.id && !pendingAction.resolved;

  const updateGuess = (val) => {
    setGuess(val);
    if (val.trim().length < 1) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(allChars.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5));
  };

  const submitQuestion = () => {
    if (!question.trim() || waiting) return;
    onSubmitQuestion(question.trim());
    setQuestion('');
  };

  const submitGuess = () => {
    if (!guess.trim() || waiting) return;
    setSuggestions([]);
    onSubmitGuess(guess.trim());
    setGuess('');
  };

  return (
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto">
      <TurnTracker players={players} currentPlayerId={guesser.id} lockedPositions={lockedPositions} />

      <div className="text-center mb-6">
        <h2 className="text-3xl font-black text-white">🎮 Your Turn</h2>
        <p className="text-white/50 text-base mt-1">Turn {turnCount + 1} · Ask a question or submit a guess</p>
      </div>

      <button
        onClick={() => { setShowPeekModal(true); onPeek(); }}
        disabled={hasPeeked}
        className={`w-full py-3 mb-5 rounded-xl font-bold text-base transition-all
          ${hasPeeked ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-purple-900/50 hover:bg-purple-900 text-purple-300 border border-purple-700'}`}
      >
        {hasPeeked ? '📋 Already peeked this round' : '📋 Peek at my anime list (once per round)'}
      </button>

      {waiting && (
        <p className="text-center text-white/50 mb-5">⏳ Waiting for another player to answer…</p>
      )}

      {mode === 'choose' && !waiting && (
        <div className="flex gap-4 mb-5">
          <button onClick={() => setMode('question')} className="flex-1 py-5 bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-600 hover:to-blue-800 text-white font-black text-lg rounded-xl border border-blue-600 transition-all">
            ❓ Ask a Question
          </button>
          <button onClick={() => setMode('guess')} className="flex-1 py-5 bg-gradient-to-br from-pink-700 to-purple-900 hover:from-pink-600 hover:to-purple-800 text-white font-black text-lg rounded-xl border border-pink-600 transition-all">
            🎯 Submit Guess
          </button>
        </div>
      )}

      {mode === 'question' && !waiting && (
        <div className="mb-5">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
            placeholder="Type your yes/no question..."
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-blue-500 mb-3"
          />
          <div className="flex gap-3">
            <button onClick={() => { setMode('choose'); setQuestion(''); }} className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-base">← Back</button>
            <button onClick={submitQuestion} disabled={!question.trim()} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors">Ask ❓</button>
          </div>
        </div>
      )}

      {mode === 'guess' && !waiting && (
        <div className="mb-5">
          <input
            type="text"
            value={guess}
            onChange={(e) => updateGuess(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSuggestions([]); else if (e.key === 'Enter') submitGuess(); }}
            placeholder="Type your guess..."
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-pink-500 mb-3"
          />
          {/* In-flow (not absolute) so the list never overlaps the Back/Guess
              buttons below — otherwise a click meant for Guess lands on a
              suggestion and only the second click submits. */}
          {suggestions.length > 0 && (
            <div className="w-full bg-gray-900 border border-white/20 rounded-xl overflow-hidden mb-3">
              {suggestions.map((s) => (
                <div key={`${s.series}-${s.name}`} onMouseDown={() => { setGuess(s.name); setSuggestions([]); }} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/10">
                  {s.imageUrl && <img src={s.imageUrl} loading="lazy" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                  <div>
                    <p className="text-white text-sm font-semibold">{s.name}</p>
                    <p className="text-white/40 text-xs">{s.series}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setMode('choose'); setGuess(''); setSuggestions([]); }} className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-base">← Back</button>
            <button onClick={submitGuess} disabled={!guess.trim()} className="flex-1 py-4 bg-gradient-to-r from-pink-600 to-purple-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-colors">Guess 🎯</button>
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-h-72 overflow-y-auto">
        <h4 className="text-white/60 text-sm font-bold uppercase tracking-wider mb-3">Your Question Log</h4>
        {questionLog.length === 0 ? (
          <p className="text-white/30 text-base text-center">No questions yet</p>
        ) : (
          questionLog.map((entry) => (
            <div key={entry.id} className="text-base py-2 border-b border-white/5 last:border-0">
              {entry.type === 'question' && (
                <span className="text-white/70">
                  ❓ {entry.text}
                  {entry.answer && <strong className={entry.answer === 'Yes' ? 'text-green-400' : 'text-red-400'}>{' '}— {entry.answer}</strong>}
                </span>
              )}
              {entry.type === 'guess' && (
                <span className={entry.correct ? 'text-green-400' : 'text-red-400'}>🎯 {entry.text} {entry.correct ? '✅' : '❌'}</span>
              )}
            </div>
          ))
        )}
      </div>

      {showPeekModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-lg w-full max-h-[32rem] overflow-y-auto">
            <h3 className="text-white font-black text-2xl mb-1">📋 Your Anime List</h3>
            <p className="text-white/50 text-base mb-5">Titles only — no characters!</p>
            {peekList.length === 0 ? (
              <p className="text-white/50 text-lg">No shared anime found.</p>
            ) : (
              <ul className="space-y-2">
                {peekList.map((anime) => (
                  <li key={anime.id} className="text-white/80 text-lg py-2 border-b border-white/10">{anime.title}</li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowPeekModal(false)} className="mt-5 w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-xl transition-colors">
              Got it — close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
