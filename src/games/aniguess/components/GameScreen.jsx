import { useState, useEffect, useRef, useMemo } from 'react';
import TurnTracker from './TurnTracker';
import QuestionLog from './QuestionLog';
import PeekPanel from './PeekPanel';
import WhoIsWhoPanel from './WhoIsWhoPanel';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { isCorrectGuess as matchGuess } from '../utils/guessMatch';
import { rankSuggestions } from '../utils/guessSuggest';
import { buildWhoIsWho } from '../utils/whoIsWho';
import { Avatar, Button, GhostButton, Input, Modal, Screen } from '../../../shared/ui';

export default function GameScreen({
  guesser,
  character,
  players,
  assignments = [],
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
  // Local "talk it out": questions and guesses are spoken, and the table
  // answers with the buttons. Nothing is typed and nothing is logged.
  talkMode = false,
}) {
  const [question, setQuestion] = useState('');
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const allChars = useMemo(
    () => guesser.animeList.flatMap(a => a.characters.map(c => ({ name: c.name, series: a.title, imageUrl: c.imageUrl }))),
    [guesser.animeList]
  );
  const [mode, setMode] = useState('choose'); // choose | question | guess
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  // A wrong guess / expired timer ends the turn, which swaps in the next
  // player and resets this component — so the result has to be acknowledged
  // before it's committed, or nobody ever sees what happened.
  const [turnOver, setTurnOver] = useState(null); // { reason, logEntry }
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [timerActive, setTimerActive] = useState(timerEnabled);
  const timerRef = useRef(null);
  const turnEndTimerRef = useRef(null);

  const peekList = useMemo(
    () => sharedShowsOnly
      ? guesser.animeList.filter(anime => players.some(p => p.id !== guesser.id && p.animeList.some(a => normalizeTitle(a.title) === normalizeTitle(anime.title))))
      : guesser.animeList,
    [sharedShowsOnly, guesser, players]
  );

  // Every player, including the current guesser — on one shared device their
  // character is the one the rest of the table most needs reminding of, and
  // WhoIsWhoPanel's per-player look-away gate is what keeps it from them.
  const whoIsWho = useMemo(
    () => buildWhoIsWho({
      players,
      characterFor: (id) => assignments.find((a) => a.playerId === id)?.character,
      lockedPositions,
    }),
    [players, assignments, lockedPositions]
  );

  // Reset state when guesser changes (setState during render — React recommended pattern)
  const [prevGuesserID, setPrevGuesserID] = useState(guesser.id);
  if (prevGuesserID !== guesser.id) {
    setPrevGuesserID(guesser.id);
    setQuestion('');
    setGuess('');
    setSuggestions([]);
    setActiveIdx(-1);
    setMode('choose');
    setWaitingForAnswer(false);
    setPendingQuestion('');
    setTurnOver(null);
    setTimeLeft(timerSeconds);
    setTimerActive(timerEnabled); // Start timer at the beginning of each turn
  }

  // Timer
  useEffect(() => {
    if (!timerEnabled) return;
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timerActive && timeLeft === 0) {
      turnEndTimerRef.current = setTimeout(() => {
        setTimerActive(false);
        setWaitingForAnswer(false);
        setTurnOver({
          reason: 'timer',
          logEntry: { id: crypto.randomUUID(), type: 'timer', text: "⏱️ Time's up!" },
        });
      }, 0);
    }
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(turnEndTimerRef.current);
    };
  }, [timerActive, timeLeft, timerEnabled]);

  const submitQuestion = () => {
    if (!question.trim()) return;
    // Stop the timer when the question is asked
    clearTimeout(timerRef.current);
    setTimerActive(false);
    setPendingQuestion(question.trim());
    setQuestion('');
    setWaitingForAnswer(true);
  };

  // Talk mode has no question to submit, so there is nothing to stop the timer
  // on: it runs while the question is being asked and stops on the answer,
  // which is the same clock the typed path gives you.
  const askAloud = () => {
    setMode('choose');
    setWaitingForAnswer(true);
  };

  const answerQuestion = (answer) => {
    clearTimeout(timerRef.current);
    setTimerActive(false);
    setWaitingForAnswer(false);
    // No `text` in talk mode — the question was spoken and is not recorded, and
    // an empty string would render as a blank row if the log ever came back.
    const logEntry = talkMode
      ? { id: crypto.randomUUID(), type: 'question', answer }
      : { id: crypto.randomUUID(), type: 'question', text: pendingQuestion, answer };
    setPendingQuestion('');
    onTurnComplete(logEntry);
  };

  const isCorrectGuess = (raw) => matchGuess(character, raw);

  const updateGuess = (val) => {
    setGuess(val);
    setActiveIdx(-1);
    setSuggestions(rankSuggestions(allChars, val));
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
    const logEntry = { id: crypto.randomUUID(), type: 'guess', text: guess.trim(), correct };

    if (correct) {
      onCorrectGuess(logEntry);
    } else {
      clearTimeout(timerRef.current);
      setTimerActive(false);
      setGuess('');
      setTurnOver({ reason: 'wrong', logEntry });
    }
  };

  // Talk mode's guess: said out loud, so the table rules on it rather than
  // matchGuess. A correct one still records the character's real name, because
  // CorrectGuessScreen and the round-end summary both read that text.
  const judgeSpokenGuess = (correct) => {
    const logEntry = correct
      ? { id: crypto.randomUUID(), type: 'guess', text: character.name, correct: true }
      : { id: crypto.randomUUID(), type: 'guess', correct: false };

    if (correct) {
      onCorrectGuess(logEntry);
    } else {
      clearTimeout(timerRef.current);
      setTimerActive(false);
      setTurnOver({ reason: 'wrong', logEntry });
    }
  };

  // Commits the turn-ending action the player just acknowledged.
  const confirmTurnOver = () => {
    const { reason, logEntry } = turnOver;
    setTurnOver(null);
    if (reason === 'timer') onTurnComplete(logEntry);
    else onWrongGuess(logEntry);
  };

  const timerColor = timeLeft > 10 ? 'text-pop-lime' : timeLeft > 5 ? 'text-pop-amber' : 'text-pop-red';

  return (
    <Screen width="md">
      <TurnTracker
        players={players}
        currentPlayerId={guesser.id}
        lockedPositions={lockedPositions}
      />

      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-extrabold text-white">
          🎮 {guesser.name}&apos;s Turn
        </h2>
        <p className="mt-1 text-base text-white/50">
          Turn {turnCount + 1} · Ask a question or submit a guess
        </p>
      </div>

      {/* Timer */}
      {timerEnabled && timerActive && (
        <div className={`mb-4 text-center font-display text-5xl font-extrabold ${timerColor}`}>
          ⏱️ {timeLeft}s
        </div>
      )}

      <PeekPanel peekList={peekList} hasPeeked={hasPeeked} onPeek={onPeek} />

      <WhoIsWhoPanel entries={whoIsWho} gated />

      {/* Action Area */}
      {mode === 'choose' && !waitingForAnswer && (
        <div className="mb-5 flex gap-4">
          <Button
            variant="info"
            size="lg"
            className="flex-1"
            onClick={talkMode ? askAloud : () => setMode('question')}
          >
            ❓ Ask a Question
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={() => setMode('guess')}>
            🎯 Submit Guess
          </Button>
        </div>
      )}

      {/* Unreachable in talk mode — askAloud jumps straight to the Yes/No card
          rather than routing through a question to type. */}
      {mode === 'question' && !talkMode && !waitingForAnswer && (
        <div className="mb-5">
          <Input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && question.trim() && submitQuestion()}
            placeholder="Type your yes/no question..."
            aria-label="Your question"
            autoFocus
            className="mb-3 text-lg"
          />
          <div className="flex gap-3">
            <GhostButton onClick={() => { setMode('choose'); setQuestion(''); }}>
              ← Back
            </GhostButton>
            <Button
              variant="info"
              size="lg"
              className="flex-1"
              onClick={submitQuestion}
              disabled={!question.trim()}
            >
              Ask ❓
            </Button>
          </div>
        </div>
      )}

      {mode === 'guess' && talkMode && (
        <div className="mb-5">
          <div className="card-pop p-6 text-center">
            <div className="text-5xl">🗣️</div>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">
              {guesser.name}, say your guess out loud
            </p>
            <p className="mt-2 text-base text-white/50">
              Everyone else — did they get it?
            </p>
            <div className="mt-6 flex gap-4">
              <Button
                variant="success"
                size="xl"
                className="flex-1"
                onClick={() => judgeSpokenGuess(true)}
              >
                ✅ Got it
              </Button>
              <Button
                variant="danger"
                size="xl"
                className="flex-1"
                onClick={() => judgeSpokenGuess(false)}
              >
                ❌ Nope
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <GhostButton onClick={() => setMode('choose')}>← Back</GhostButton>
          </div>
        </div>
      )}

      {mode === 'guess' && !talkMode && (
        <div className="mb-5">
          <Input
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
            aria-label="Your guess"
            autoFocus
            className="mb-3 text-lg"
          />
          {/* In-flow (not absolute) so the list never overlaps the Back/Guess buttons below. */}
          {suggestions.length > 0 && (
            <div className="mb-3 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-pop border-2 border-white/15 bg-surface">
              {suggestions.map((s, i) => (
                <div
                  key={`${s.series}-${s.name}`}
                  onMouseDown={() => pickSuggestion(s.name)}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2
                    ${i === activeIdx ? 'bg-pop-pink/30' : 'hover:bg-white/10'}`}
                >
                  <Avatar src={s.imageUrl} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-white">{s.name}</p>
                    <p className="text-xs text-white/40">{s.series}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <GhostButton onClick={() => { setMode('choose'); setGuess(''); setSuggestions([]); }}>
              ← Back
            </GhostButton>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={submitGuess}
              disabled={!guess.trim()}
            >
              Guess 🎯
            </Button>
          </div>
        </div>
      )}

      {/* Yes / No buttons */}
      {waitingForAnswer && (
        <div className="mb-5">
          {talkMode ? (
            <p className="mb-4 text-center text-base text-white/60">
              ❓ <span className="font-display text-lg font-extrabold text-white">
                {guesser.name}, ask your yes/no question out loud
              </span>
            </p>
          ) : (
            <p className="mb-4 text-center text-base text-white/60">
              ❓ <span className="font-display text-lg font-extrabold text-white">{pendingQuestion}</span>
            </p>
          )}
          <p className="mb-4 text-center text-sm text-white/40">
            Everyone else — answer this question
          </p>
          <div className="flex gap-4">
            <Button variant="success" size="xl" className="flex-1" onClick={() => answerQuestion('Yes')}>
              ✅ Yes
            </Button>
            <Button variant="danger" size="xl" className="flex-1" onClick={() => answerQuestion('No')}>
              ❌ No
            </Button>
          </div>
        </div>
      )}

      {/* Talk mode records nothing, so the log would be permanently empty. */}
      {!talkMode && (
        <QuestionLog title={`${guesser.name}'s Question Log`} entries={questionLog} />
      )}

      {/* Turn-over acknowledgement — blocks until the device is handed on, so
          the result doesn't vanish the instant the next player's turn loads.
          Deliberately not dismissible: the log entry is only committed by the
          button, so an Escape or backdrop click would drop the turn's result. */}
      {turnOver && (
        <Modal dismissible={false} bare width="md" className="text-center">
          <div className="mb-6 text-8xl">{turnOver.reason === 'timer' ? '⏱️' : '❌'}</div>
          <h2 className="mb-3 font-display text-4xl font-extrabold text-white">
            {turnOver.reason === 'timer' ? "Time's up!" : 'Not quite!'}
          </h2>
          {/* A spoken guess has no text to quote back — the check is on the
              text, not on the reason, so talk mode simply drops this line. */}
          {turnOver.reason === 'wrong' && turnOver.logEntry.text && (
            <p className="mb-3 text-xl text-white/60">
              <span className="font-bold text-white">&quot;{turnOver.logEntry.text}&quot;</span>{' '}
              isn&apos;t your character.
            </p>
          )}
          <p className="mb-10 text-lg text-white/50">{guesser.name}&apos;s turn is over.</p>
          <Button variant="primary" size="xl" fullWidth onClick={confirmTurnOver}>
            Pass the device →
          </Button>
        </Modal>
      )}
    </Screen>
  );
}
