import { useEffect, useRef, useState } from 'react';
import { useAniTuneRoom } from './hooks/useAniTuneRoom';
import { RACE } from './rules';
import RoomSetup from './components/RoomSetup';
import OnlineLobby from './components/OnlineLobby';
import SyncedClipPlayer from './components/SyncedClipPlayer';
import OnlineRaceRound from './components/OnlineRaceRound';
import OnlineSimultaneousRound from './components/OnlineSimultaneousRound';
import QuestionReveal from './components/QuestionReveal';
import AniTuneResults from './components/AniTuneResults';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Backdrop, Badge, Banner, GhostButton, HubButton, Screen } from '../../shared/ui';

// The online view-router — the Firebase-backed counterpart to AniTuneRound's local
// orchestration. Modelled on src/games/aniguess/OnlineGame.jsx: a shell() wraps
// every in-room screen with the room code, a way out, and the sync-error banner,
// and room.view picks the screen. The AniTune-specific parts are the synchronized
// clip (the readiness → clipStartAt handshake below) and the two per-device modes.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniTuneRoom();

  // Local playback flags for the current question; reset when the question (or
  // the whole round) changes. clipStarted enables buzzing/guessing; clipDone
  // reveals the "nobody got it" escape.
  const [clipStarted, setClipStarted] = useState(false);
  const [clipDone, setClipDone] = useState(false);
  useEffect(() => {
    setClipStarted(false);
    setClipDone(false);
  }, [room.game?.index, room.view]);

  // Once every device has tapped "ready", one of them stamps the shared start
  // time (a transaction, so only the first stamp sticks). Ref-guarded to one
  // write per question per device.
  const clipStartWriterRef = useRef(null);
  useEffect(() => {
    if (room.view !== 'round') return;
    const g = room.game;
    if (!g || g.phase !== 'listening' || g.clipStartAt != null || !room.allReady) return;
    if (clipStartWriterRef.current === g.index) return;
    clipStartWriterRef.current = g.index;
    room.setClipStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.game, room.allReady]);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup room={room} onBack={onBack} />
      </>
    );
  }

  const handleLeave = () => {
    if (!window.confirm('Leave this room? You can rejoin with the same name and room code.')) return;
    room.leaveRoom();
  };

  const handleExitToHub = () => {
    room.leaveRoom();
    onExit();
  };

  // Wraps every in-room screen so the way out and connection problems are always
  // reachable, whatever phase the game is in.
  const shell = (children) => (
    <div className="relative">
      <HubButton
        onClick={handleExitToHub}
        confirm="Leave this room and return to the hub? You can rejoin with the same name and room code."
      />
      <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
        <span className="hidden font-display text-xs tracking-widest text-white/40 sm:inline">
          {room.roomCode}
        </span>
        <button
          onClick={handleLeave}
          className="focus-pop rounded-pop-sm bg-black/40 px-3 py-1.5 font-display text-sm font-bold
            text-white/60 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          Leave
        </button>
      </div>
      <div className="fixed top-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md
        -translate-x-1/2 flex-col gap-2">
        {room.syncError && (
          <Banner tone="danger" onDismiss={room.dismissSyncError} className="bg-canvas/95 backdrop-blur-sm">
            ⚠️ {room.syncError}
          </Banner>
        )}
        {/* Says out loud why the round has paused, and for how much longer, so a
            dropped player doesn't just look like a frozen game. */}
        {room.dropping.map(({ player, remainingMs }) => (
          <Banner key={player.id} tone="warning" className="bg-canvas/95 backdrop-blur-sm">
            🔌 {player.name} disconnected — waiting {Math.ceil(remainingMs / 1000)}s…
          </Banner>
        ))}
      </div>
      {children}
    </div>
  );

  if (!room.view) {
    return shell(<WaitingScreen emoji="🌐" title="Loading room…" />);
  }

  if (room.view === 'lobby') {
    return shell(<OnlineLobby room={room} />);
  }

  if (room.view === 'preparing') {
    const p = room.prepProgress;
    return shell(
      <>
        <Backdrop />
        <Screen center className="text-center">
          <div className="mb-5 text-7xl">🎧</div>
          <h2 className="mb-3 font-display text-3xl font-extrabold text-white">
            {room.isPreparing ? 'Finding songs…' : 'Host is finding songs…'}
          </h2>
          {room.isPreparing && p ? (
            <div className="mx-auto w-full max-w-sm">
              <p className="mb-2 text-base text-white/60">
                {p.phase === 'resolving' ? 'Matching shows…' : 'Loading themes…'} {p.done}/{p.total}
              </p>
              <div className="h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
                <div
                  className="h-full bg-pop-blue transition-[width]"
                  style={{ width: `${(p.done / Math.max(p.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-lg text-white/60">Hang tight — the round is being dealt.</p>
          )}
        </Screen>
      </>
    );
  }

  if (room.view === 'round' && room.game && room.round) {
    const { game, round } = room;
    const question = round[game.index];
    if (!question) return shell(<WaitingScreen emoji="🎵" title="Loading clip…" />);

    const revealed = game.phase === 'revealed';
    const isLast = game.index + 1 >= round.length;
    const clipSeconds = room.settings?.clipSeconds ?? 10;
    const ranked = [...room.players].sort(
      (a, b) => (game.scores[b.id] || 0) - (game.scores[a.id] || 0)
    );

    return shell(
      <>
        <Backdrop />
        <Screen width="md">
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {ranked.map((p) => {
              // Departed players keep their frozen score on the board, dimmed,
              // so the room can still see how the match stood when they went.
              const gone = room.departedIds.includes(p.id);
              return (
                <Badge
                  key={p.id}
                  tone={p.id === game.buzzedBy ? 'purple' : 'neutral'}
                  className={gone ? 'opacity-40' : ''}
                >
                  {p.name}{p.id === room.myPlayerId ? ' (you)' : ''} {game.scores[p.id] || 0}
                  {gone && ' · left'}
                </Badge>
              );
            })}
          </div>

          <p className="mb-1 text-center text-base text-white/40">
            Question {game.index + 1} of {round.length}
          </p>
          <h2 className="mb-6 text-center font-display text-3xl font-extrabold text-white">
            {game.mode === RACE ? 'Buzz in 🔔' : 'Everyone guesses 🤫'}
          </h2>

          <SyncedClipPlayer
            key={question.id}
            src={question.audioUrl}
            seconds={clipSeconds}
            clipFraction={question.clipFraction ?? 0.4}
            clipStartAt={game.clipStartAt}
            serverOffset={room.serverOffset}
            paused={game.phase === 'buzzed'}
            revealed={revealed}
            onReady={room.markReady}
            onStarted={() => setClipStarted(true)}
            onWindowEnded={() => setClipDone(true)}
            onUnplayable={() => setClipDone(true)}
          />

          {!revealed && game.mode === RACE && (
            <OnlineRaceRound
              players={room.activePlayers}
              questions={round}
              question={question}
              game={game}
              myPlayerId={room.myPlayerId}
              isMyBuzz={room.isMyBuzz}
              clipStarted={clipStarted}
              clipDone={clipDone}
              onBuzz={room.buzz}
              onAnswer={(guess) => room.resolveBuzz(question, guess)}
              onGiveUp={room.giveUp}
            />
          )}

          {!revealed && game.mode !== RACE && (
            <OnlineSimultaneousRound
              players={room.activePlayers}
              questions={round}
              question={question}
              game={game}
              myPlayerId={room.myPlayerId}
              iHaveAnswered={room.iHaveAnswered}
              clipStarted={clipStarted}
              onSubmit={(text) => room.submitAnswer(question, text)}
              onReveal={room.revealNow}
            />
          )}

          {revealed && (
            <QuestionReveal
              question={question}
              mode={game.mode}
              players={room.players}
              answers={game.answers}
              onNext={room.advance}
              nextLabel={isLast ? 'See results →' : 'Next question →'}
            />
          )}

          <div className="mt-6 text-center">
            <GhostButton onClick={handleExitToHub}>← Leave game</GhostButton>
          </div>
        </Screen>
      </>
    );
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniTuneResults
        players={room.players}
        scores={room.game.scores}
        departedIds={room.departedIds}
        roundSize={room.round?.length ?? Object.keys(room.game.scores).length}
        onPlayAgain={room.returnToLobby}
        onExit={handleExitToHub}
      />
    );
  }

  return shell(<WaitingScreen emoji="🌐" title="Loading…" />);
}
