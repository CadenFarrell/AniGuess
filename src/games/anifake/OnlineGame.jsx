import { useAniFakeRoom } from './hooks/useAniFakeRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import { countCharacters } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import ClueRound from './components/ClueRound';
import VoteScreen from './components/VoteScreen';
import StealScreen from './components/StealScreen';
import AniFakeResults from './components/AniFakeResults';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Banner, HubButton } from '../../shared/ui';

// The online view-router. Same shape as src/games/anirank/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniFakeRoom();

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          room={room}
          onBack={onBack}
          tone="teal"
          stat={(p) => `${countCharacters(p)} characters`}
        />
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

  if (!room.view) return shell(<WaitingScreen emoji="🌐" title="Loading room…" />);

  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />);

  if (room.view === 'clues' && room.game) {
    return shell(
      <ClueRound
        clues={room.clues}
        players={room.players}
        speaker={room.speaker}
        isMyTurn={room.isMyTurn}
        card={room.card}
        wordLimit={room.wordLimit}
        lap={room.lap}
        laps={room.laps}
        onSubmit={room.submitClue}
        onQuit={handleExitToHub}
      />
    );
  }

  if (room.view === 'vote' && room.game) {
    return shell(
      <VoteScreen
        players={room.players}
        voter={room.players.find((p) => p.id === room.myPlayerId) ?? null}
        voted={room.votedIds}
        departedIds={room.departedIds}
        clues={room.clues}
        myVote={room.myVote}
        onVote={room.castVote}
      />
    );
  }

  if (room.view === 'steal' && room.game) {
    // Only the accused reaches this with a steal to make; everyone else gets
    // the waiting half of the same screen. Reaching this view at all means the
    // accused WAS the fake — their own device is the only one that could have
    // set it — so naming them here gives nothing away that the next screen
    // won't.
    const isMine = Boolean(room.card?.isFake);
    const accused = room.players.find((p) => p.id === room.caught);
    return shell(
      <StealScreen
        isMine={isMine}
        fakeName={accused?.name ?? 'The fake'}
        onSteal={room.submitSteal}
      />
    );
  }

  if (room.view === 'reveal') {
    // The publish window: every device is writing its own card into the round
    // right now, and the answer is only reconstructible once they land.
    return shell(<WaitingScreen emoji="🃏" title="Turning the cards over…" />);
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniFakeResults
        players={room.players}
        game={room.game}
        fakeId={room.fakeId}
        secret={room.secret}
        fakeCard={room.fakeCard}
        roundScores={room.roundScores}
        totalScores={room.totalScores}
        departedIds={room.departedIds}
        onPlayAgain={room.returnToLobby}
        onExit={handleExitToHub}
        playAgainLabel="🔁 Back to lobby"
      />
    );
  }

  return shell(<WaitingScreen emoji="🌐" title="Loading…" />);
}
