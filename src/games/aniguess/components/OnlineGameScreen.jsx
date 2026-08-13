import { useState, useMemo } from 'react';
import TurnTracker from './TurnTracker';
import LastOutcomeBanner from './LastOutcomeBanner';
import QuestionLog from './QuestionLog';
import PeekPanel from './PeekPanel';
import WhoIsWhoPanel from './WhoIsWhoPanel';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { rankSuggestions } from '../../../shared/utils/guessSuggest';
import { Avatar, Button, Combobox, GhostButton, Input, Screen } from '../../../shared/ui';

// The active guesser's device. Deliberately never receives the assigned
// character — only raw question/guess text ever leaves this device, sent via
// onSubmitQuestion/onSubmitGuess for a non-guesser device to resolve (see
// useRoom.js's submitPendingAction / OnlineAnswererView's resolvePendingAction).
export default function OnlineGameScreen({
  guesser,
  players,
  whoIsWho = [],
  lockedPositions,
  questionLog,
  turnCount,
  hasPeeked,
  onPeek,
  onSubmitQuestion,
  onSubmitGuess,
  pendingAction,
  lastOutcome,
  sharedShowsOnly = true,
}) {
  const [mode, setMode] = useState('choose'); // choose | question | guess
  const [question, setQuestion] = useState('');
  const [guess, setGuess] = useState('');
  const [suggestions, setSuggestions] = useState([]);

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
    setSuggestions(rankSuggestions(allChars, val));
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
    <Screen width="md">
      <TurnTracker players={players} currentPlayerId={guesser.id} lockedPositions={lockedPositions} />

      <LastOutcomeBanner outcome={lastOutcome} />

      <div className="mb-6 text-center">
        <h2 className="font-display text-3xl font-extrabold text-white">🎮 Your Turn</h2>
        <p className="mt-1 text-base text-white/50">
          Turn {turnCount + 1} · Ask a question or submit a guess
        </p>
      </div>

      <PeekPanel peekList={peekList} hasPeeked={hasPeeked} onPeek={onPeek} />

      <WhoIsWhoPanel entries={whoIsWho} />

      {waiting && (
        <p className="mb-5 text-center text-white/50">
          ⏳ Waiting for another player to answer…
        </p>
      )}

      {mode === 'choose' && !waiting && (
        <div className="mb-5 flex gap-4">
          <Button variant="info" size="lg" className="flex-1" onClick={() => setMode('question')}>
            ❓ Ask a Question
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={() => setMode('guess')}>
            🎯 Submit Guess
          </Button>
        </div>
      )}

      {mode === 'question' && !waiting && (
        <div className="mb-5">
          <Input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitQuestion()}
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

      {mode === 'guess' && !waiting && (
        <div className="mb-5">
          <Combobox
            value={guess}
            onChange={updateGuess}
            suggestions={suggestions}
            onSelect={(s) => { setGuess(s.name); setSuggestions([]); }}
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

      <QuestionLog title="Your Question Log" entries={questionLog} />
    </Screen>
  );
}
