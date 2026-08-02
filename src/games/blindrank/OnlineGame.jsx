import { useBlindRankRoom } from './hooks/useBlindRankRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import { countShows } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import BlindRankResults from './components/BlindRankResults';
import RankBoard, { CurrentShow, WaitingOn } from './components/RankBoard';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Backdrop, Badge, Banner, GhostButton, HubButton, Screen } from '../../shared/ui';

// The online view-router. Same shape as src/games/anitune/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useBlindRankRoom();

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        <RoomSetup
          room={room}
          onBack={onBack}
          tone="amber"
          stat={(p) => `${countShows(p)} shows`}
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
        {/* Says out loud why the board has paused, and for how much longer, so a
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

  if (room.view === 'round' && room.game) {
    return shell(
      <>
        <Backdrop />
        <Screen width="md">
          <div className="mb-6 flex flex-wrap justify-center gap-2">
            {room.players.map((p) => {
              const gone = room.departedIds.includes(p.id);
              const waiting = room.pendingNames.includes(p.name);
              return (
                <Badge
                  key={p.id}
                  tone={waiting ? 'neutral' : 'lime'}
                  className={gone ? 'opacity-40' : ''}
                >
                  {p.name}{p.id === room.myPlayerId ? ' (you)' : ''}
                  {!waiting && !gone && ' ✓'}
                  {gone && ' · left'}
                </Badge>
              );
            })}
          </div>

          <CurrentShow item={room.item} index={room.cursor} total={room.deck.length} />

          {room.iHavePlaced ? (
            <>
              <p className="mb-2 text-center font-display text-lg font-extrabold text-pop-lime">
                Locked in ✓
              </p>
              <WaitingOn names={room.pendingNames} />
            </>
          ) : (
            <p className="mb-4 text-center text-base text-white/50">
              Pick a slot. Once it is placed it cannot be moved.
            </p>
          )}

          <RankBoard
            board={room.myBoard}
            item={room.item}
            disabled={room.iHavePlaced}
            onPlace={room.place}
          />

          <div className="text-center">
            <GhostButton onClick={handleExitToHub}>← Leave game</GhostButton>
          </div>
        </Screen>
      </>
    );
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <BlindRankResults
        players={room.players}
        boards={room.game.boards}
        deck={room.deck}
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
