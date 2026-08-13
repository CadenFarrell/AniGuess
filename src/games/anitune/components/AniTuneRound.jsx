import { useEffect, useMemo, useRef, useState } from 'react';
import ClipPlayer from './ClipPlayer';
import RaceRound from './RaceRound';
import SimultaneousRound from './SimultaneousRound';
import QuestionReveal from './QuestionReveal';
import { useAniTuneRound } from '../hooks/useAniTuneRound';
import { isRace, hasLives, isEliminated } from '../rules';
import { formatPoints } from '../../../shared/utils/deadline';
import { Backdrop, Badge, GhostButton, Screen, TimerBar } from '../../../shared/ui';

// Orchestrates one round: scoreboard, clip, and whichever mode's input area is
// in play. All the game logic lives in ../rules.js via useAniTuneRound — this
// component only decides what to render for the current phase.
//
// onBackToSetup re-deals with the same players. Leaving the game entirely is not
// this component's business: LocalGame renders the one fixed "🏠 Hub" button
// over every local view, so the exit stays in the same corner on all of them.
export default function AniTuneRound({
  round, players, questions, clipSeconds, playbackRate = 1, mode, settings = {},
  initialState = null, onProgress, onFinish, onBackToSetup,
}) {
  const {
    state, activeId, isLastQuestion, clock, setQuestion, openWindow,
    buzz, resolveBuzz, giveUp, startGuessing, beginEntry, submitAnswer, advance,
  } = useAniTuneRound(players, mode, round.length, settings, initialState);

  // Hand every state change up so LocalGame can save it. Here rather than in the
  // hook because the hook is the online twin's shape too, and only local play
  // has somewhere to put it.
  useEffect(() => { onProgress?.(state); }, [state, onProgress]);

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
  const race = isRace(mode);
  const lastManStanding = hasLives(mode);

  // The expiry rule needs the question to grade the blank answers it records,
  // and it fires from a timer rather than from a handler — so hand the current
  // one down rather than making the hook reach back up for it.
  useEffect(() => { setQuestion(question); }, [question, setQuestion]);

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

  // Lives can end the round early, so "is this the last one" is a question only
  // the rules can answer — nextQuestion reports it, and a finished patch is
  // empty, which is how a last-one-standing round stops without running the
  // remaining clips.
  const next = () => {
    if (advance()) {
      onFinish({
        scores: state.scores,
        lives: state.lives,
        eliminated: state.eliminated,
        // How many clips actually played. Not round.length: Lives can finish the
        // round early, leaving dealt-but-unheard questions the recap must not
        // list.
        playedCount: state.index + 1,
      });
    }
  };

  const ranked = useMemo(
    () => [...players].sort((a, b) => (state.scores[b.id] || 0) - (state.scores[a.id] || 0)),
    [players, state.scores]
  );

  if (!question) return null;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        {/* Scoreboard. In Lives the hearts matter more than the points, so they
            sit beside the name and a knocked-out player is struck through rather
            than dropped — being out is a standing, not an absence. */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {ranked.map((p) => {
            const out = lastManStanding && isEliminated(state, p.id);
            return (
              <Badge
                key={p.id}
                tone={out ? 'red' : p.id === activeId ? 'purple' : 'neutral'}
                className={out ? 'opacity-60' : ''}
              >
                {p.name} {formatPoints(state.scores[p.id] || 0)}
                {lastManStanding && (
                  <span className="ml-1">
                    {out ? '💀' : '♥'.repeat(Math.max(0, state.lives?.[p.id] ?? 0))}
                  </span>
                )}
              </Badge>
            );
          })}
        </div>

        <p className="mb-1 text-center text-base text-white/40">
          Question {state.index + 1} of {round.length}
        </p>
        <h2 className="mb-6 text-center font-display text-3xl font-extrabold text-white">
          {race ? 'Buzz in 🔔' : lastManStanding ? 'Last one standing 💀' : 'Everyone guesses 🤫'}
        </h2>

        <ClipPlayer
          key={question.id}
          src={question.audioUrl}
          seconds={clipSeconds}
          fraction={question.clipFraction}
          playbackRate={playbackRate}
          revealed={revealed}
          paused={paused}
          // The scoring window opens with the music, not with the deal — the
          // clip can take seconds to load off a cold CDN, and starting the clock
          // before anyone can hear anything would score patience.
          onStarted={openWindow}
          onWindowEnded={() => setClipDoneIndex(state.index)}
          // A clip the CDN never served would otherwise strand race mode: with
          // nothing to listen to and no window to run out, the only way on
          // would be for every player to deliberately buzz and miss.
          onUnplayable={() => setClipDoneIndex(state.index)}
        />

        {/* The guess clock, distinct from the clip's own progress bar above:
            that one is how much song is left, this is how long you have. They
            are deliberately different lengths. */}
        {!revealed && state.deadlineAt != null && (
          <TimerBar
            className="mt-4"
            secondsLeft={clock.secondsLeft}
            fraction={clock.fraction}
            label={state.phase === 'buzzed' ? 'Time to answer' : 'Time to guess'}
          />
        )}

        {!revealed && race && (
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

        {!revealed && !race && (
          <SimultaneousRound
            players={players}
            questions={questions}
            phase={state.phase}
            entryOrder={state.entryOrder}
            entryIndex={state.entryIndex}
            answers={state.answers}
            lives={lastManStanding ? state.lives : null}
            eliminated={state.eliminated}
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
            windowMs={state.windowMs}
            lives={lastManStanding ? state.lives : null}
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
