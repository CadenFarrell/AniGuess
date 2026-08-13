import { useState, useEffect, useRef, useMemo } from 'react';
import TurnTracker from './TurnTracker';
import QuestionLog from './QuestionLog';
import PeekPanel from './PeekPanel';
import WhoIsWhoPanel from './WhoIsWhoPanel';
import TalkTurn from './TalkTurn';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { isCorrectGuess as matchGuess } from '../utils/guessMatch';
import { rankSuggestions } from '../../../shared/utils/guessSuggest';
import { buildWhoIsWho } from '../utils/whoIsWho';
import { answerTrail } from '../utils/answerTrail';
import { Avatar, Button, Combobox, GhostButton, Input, Modal, Screen } from '../../../shared/ui';

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
  // Local "talk it out": questions and guesses are spoken, and the table taps
  // the outcome. Nothing is typed, and the whole turn is one tap.
  talkMode = false,
}) {
  const [question, setQuestion] = useState('');
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  // Flattening every show's cast on each turn is wasted work in talk mode,
  // which never renders the suggestion list this feeds.
  const allChars = useMemo(
    () => talkMode
      ? []
      : guesser.animeList.flatMap(a => a.characters.map(c => ({ name: c.name, series: a.title, imageUrl: c.imageUrl }))),
    [guesser.animeList, talkMode]
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

  // Talk mode's stand-in for the question log. The questions themselves are
  // spoken and unrecorded, but the answers still carry the one thing the table
  // asks the log for: how many questions this player has already burned.
  const trail = useMemo(
    () => talkMode ? answerTrail(questionLog) : [],
    [talkMode, questionLog]
  );

  // Everything this component holds that belongs to one turn rather than to the
  // game. Called from two places, and the second is not optional: the guesser
  // only *changes* while somebody else is still unlocked, so once one player is
  // left they take consecutive turns without this component re-rendering under
  // a new id — and would inherit the stopped clock the last turn ended on.
  const resetTurn = () => {
    setQuestion('');
    setGuess('');
    // Clearing the suggestions is the whole reset now: Combobox owns the
    // highlight and re-seeds it on the next keystroke.
    setSuggestions([]);
    setMode('choose');
    setWaitingForAnswer(false);
    setPendingQuestion('');
    setTurnOver(null);
    setTimeLeft(timerSeconds);
    setTimerActive(timerEnabled); // Start timer at the beginning of each turn
  };

  // Reset state when guesser changes (setState during render — React recommended pattern)
  const [prevGuesserID, setPrevGuesserID] = useState(guesser.id);
  if (prevGuesserID !== guesser.id) {
    setPrevGuesserID(guesser.id);
    resetTurn();
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

  const answerQuestion = (answer) => {
    clearTimeout(timerRef.current);
    // No `text` in talk mode — the question was spoken and is not recorded, and
    // an empty string would render as a blank row in the typed-mode log.
    const logEntry = talkMode
      ? { id: crypto.randomUUID(), type: 'question', answer }
      : { id: crypto.randomUUID(), type: 'question', text: pendingQuestion, answer };
    resetTurn();
    onTurnComplete(logEntry);
  };

  const isCorrectGuess = (raw) => matchGuess(character, raw);

  // Ranking stays here rather than inside Combobox, deliberately: AniGuess ranks
  // characters and AniTune ranks titles, and the two want different match tiers.
  const updateGuess = (val) => {
    setGuess(val);
    setSuggestions(rankSuggestions(allChars, val));
  };

  const pickSuggestion = (name) => {
    setGuess(name);
    setSuggestions([]);
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
  //
  // A wrong one commits straight away rather than through the acknowledgement
  // modal. That modal exists so a result doesn't vanish as the device changes
  // hands — but at a talk-mode table the device isn't going anywhere and the
  // whole table just watched the guess get judged, so it was a tap that told
  // nobody anything.
  const judgeSpokenGuess = (correct) => {
    const logEntry = correct
      ? { id: crypto.randomUUID(), type: 'guess', text: character.name, correct: true }
      : { id: crypto.randomUUID(), type: 'guess', correct: false };

    if (correct) {
      onCorrectGuess(logEntry);
    } else {
      clearTimeout(timerRef.current);
      resetTurn();
      onWrongGuess(logEntry);
    }
  };

  // Commits the turn-ending action the player just acknowledged.
  const confirmTurnOver = () => {
    const { reason, logEntry } = turnOver;
    resetTurn();
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

      {/* Action Area. Talk mode swaps the entire ask-or-guess choreography for
          one card, rather than threading a flag through each screen below: the
          spoken turn has no question to type, no guess to type and no verdict
          to compute, so the only thing the two paths shared was the Yes/No
          pair — and the typed path reads as it did before talk mode existed. */}
      {talkMode ? (
        <TalkTurn
          guesserName={guesser.name}
          onAnswer={answerQuestion}
          onJudgeGuess={judgeSpokenGuess}
          trail={trail}
        />
      ) : (
        <>
          {mode === 'choose' && !waitingForAnswer && (
            <div className="mb-5 flex gap-4">
              <Button variant="info" size="lg" className="flex-1" onClick={() => setMode('question')}>
                ❓ Ask a Question
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={() => setMode('guess')}>
                🎯 Submit Guess
              </Button>
            </div>
          )}

          {mode === 'question' && !waitingForAnswer && (
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

          {mode === 'guess' && (
            <div className="mb-5">
              <Combobox
                value={guess}
                onChange={updateGuess}
                suggestions={suggestions}
                onSelect={(s) => pickSuggestion(s.name)}
                onSubmit={submitGuess}
                optionKey={(s) => `${s.series}-${s.name}`}
                renderOption={(s) => (
                  <>
                    <Avatar src={s.imageUrl} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-white">{s.name}</p>
                      <p className="text-xs text-white/40">{s.series}</p>
                    </div>
                  </>
                )}
                placeholder="Type your guess..."
                ariaLabel="Your guess"
                autoFocus
                className="mb-3"
              />
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
              <p className="mb-4 text-center text-base text-white/60">
                ❓ <span className="font-display text-lg font-extrabold text-white">{pendingQuestion}</span>
              </p>
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

          {/* Talk mode's equivalent is the answer trail inside TalkTurn — a
              spoken question has no text, so these rows would all be blank. */}
          <QuestionLog title={`${guesser.name}'s Question Log`} entries={questionLog} />
        </>
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
          {turnOver.reason === 'wrong' && (
            <p className="mb-3 text-xl text-white/60">
              <span className="font-bold text-white">&quot;{turnOver.logEntry.text}&quot;</span>{' '}
              isn&apos;t your character.
            </p>
          )}
          <p className="mb-10 text-lg text-white/50">{guesser.name}&apos;s turn is over.</p>
          {/* Talk mode only ever reaches this modal on an expired timer — a
              wrong guess commits on the tap that judged it. Nobody is passing
              the device at that table, so the label says what is happening. */}
          <Button variant="primary" size="xl" fullWidth onClick={confirmTurnOver}>
            {talkMode ? 'Next player →' : 'Pass the device →'}
          </Button>
        </Modal>
      )}
    </Screen>
  );
}
