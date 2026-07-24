import { useEffect, useMemo, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer';
import RaceRound from './RaceRound';
import SimultaneousRound from './SimultaneousRound';
import QuestionReveal from './QuestionReveal';
import { useAniTuneRound } from '../hooks/useAniTuneRound';
import { RACE } from '../rules';
import { Backdrop, Badge, GhostButton, HubButton, Screen } from '../../../shared/ui';

// Orchestrates one round: scoreboard, clip, and whichever mode's input area is
// in play. All the game logic lives in ../rules.js via useAniTuneRound — this
// component only decides what to render for the current phase.
//
// The two exits go to different places and are deliberately kept separate:
// onBackToSetup re-deals with the same players, onQuitToHub leaves the game.
export default function AniTuneRound({
  round, players, questions, clipSeconds, mode, onFinish, onBackToSetup, onQuitToHub,
}) {
  const {
    state, activeId, isLastQuestion,
    buzz, resolveBuzz, giveUp, startGuessing, beginEntry, submitAnswer, advance,
  } = useAniTuneRound(players, mode, round.length);

  // Which question's clip has nothing left to give — either its window ran out
  // or it never loaded at all. Stored as an index rather than a flag so it
  // resets itself on the next question without an effect.
  const [clipDoneIndex, setClipDoneIndex] = useState(-1);
  const preloadRef = useRef(null);

  const question = round[state.index];
  const revealed = state.phase === 'revealed';
  // The clip holds while a buzzed player answers and while the device is being
  // handed over; the person actually typing may replay it.
  const paused = state.phase === 'buzzed' || state.phase === 'handoff';
  const clipDone = clipDoneIndex === state.index;

  // Warm the next clip — metadata alone took ~2s in testing, which would
  // otherwise be dead air between questions. Delayed rather than immediate:
  // the CDN 503s under concurrent requests, and the clip being played right
  // now must win that race.
  useEffect(() => {
    const next = round[state.index + 1];
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
  }, [state.index, round]);

  const next = () => {
    if (isLastQuestion) onFinish(state.scores);
    else advance();
  };

  const ranked = useMemo(
    () => [...players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0)),
    [players, state.scores]
  );

  if (!question) return null;

  return (
    <>
      <Backdrop />
      {/* Guarded: unlike AniGuess there is no saved session to resume back
          into, so leaving really does discard the round. */}
      <HubButton
        onClick={onQuitToHub}
        confirm="Return to the hub? The scores so far will be lost."
      />
      <Screen width="md">
        {/* Scoreboard */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {ranked.map((p) => (
            <Badge key={p.id} tone={p.id === activeId ? 'purple' : 'neutral'}>
              {p.name} {state.scores[p.id] || 0}
            </Badge>
          ))}
        </div>

        <p className="mb-1 text-center text-base text-white/40">
          Question {state.index + 1} of {round.length}
        </p>
        <h2 className="mb-6 text-center font-display text-3xl font-extrabold text-white">
          {mode === RACE ? 'Buzz in 🔔' : 'Everyone guesses 🤫'}
        </h2>

        <ClipPlayer
          key={question.id}
          src={question.audioUrl}
          seconds={clipSeconds}
          revealed={revealed}
          paused={paused}
          onWindowEnded={() => setClipDoneIndex(state.index)}
          // A clip the CDN never served would otherwise strand race mode: with
          // nothing to listen to and no window to run out, the only way on
          // would be for every player to deliberately buzz and miss.
          onUnplayable={() => setClipDoneIndex(state.index)}
        />

        {!revealed && mode === RACE && (
          <RaceRound
            players={players}
            questions={questions}
            lockedOut={state.lockedOut}
            buzzedBy={state.buzzedBy}
            clipDone={clipDone}
            onBuzz={buzz}
            onAnswer={(guess) => resolveBuzz(question, guess)}
            onGiveUp={giveUp}
          />
        )}

        {!revealed && mode !== RACE && (
          <SimultaneousRound
            players={players}
            questions={questions}
            phase={state.phase}
            entryOrder={state.entryOrder}
            entryIndex={state.entryIndex}
            answers={state.answers}
            onStartGuessing={startGuessing}
            onReady={beginEntry}
            onSubmit={(text) => submitAnswer(question, text)}
          />
        )}

        {revealed && (
          <QuestionReveal
            question={question}
            mode={mode}
            players={players}
            answers={state.answers}
            onNext={next}
            nextLabel={isLastQuestion ? 'See results →' : 'Next question →'}
          />
        )}

        <div className="mt-6 text-center">
          <GhostButton onClick={onBackToSetup}>← Back to setup</GhostButton>
        </div>
      </Screen>
    </>
  );
}
