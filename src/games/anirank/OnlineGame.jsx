import { useState } from 'react';
import { useAniRankRoom } from './hooks/useAniRankRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import { countShows } from '../../shared/utils/profileStats';
import OnlineLobby from './components/OnlineLobby';
import RoomTiers from './RoomTiers';
import AniRankResults from './components/AniRankResults';
import RankBoard, { CardTray, CurrentItem, LockInButton, WaitingOn } from './components/RankBoard';
import { isOpinion, promptFor } from './axes';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Backdrop, Badge, Banner, GhostButton, HubButton, Screen } from '../../shared/ui';

// The online view-router. Same shape as src/games/anitune/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useAniRankRoom();

  // Which tray card this device has picked up in an open round. Deliberately
  // local state and never written to the room: it is a half-finished thought,
  // and everything under state/ is readable by every member.
  const [selectedId, setSelectedId] = useState(null);

  // Drop it whenever the room changes screen, so a card held over from the last
  // round is not still selected in the next one. Adjusted during render rather
  // than in an effect: React re-runs this component before committing, so no
  // cascading render — the effect version is what the lint rule forbids.
  const [seenView, setSeenView] = useState(room.view);
  if (seenView !== room.view) {
    setSeenView(room.view);
    setSelectedId(null);
  }

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

  // The room's other half. No `room.game` guard, unlike every branch below:
  // there is no round here, and startCompare explicitly nulls `game`.
  if (room.view === 'tiers') {
    return shell(<RoomTiers room={room} />);
  }

  if (room.view === 'round' && room.game) {
    const { open } = room;
    // In an open round "done" means locked in, not "placed the current card".
    const committed = open ? room.iHaveLockedIn : room.iHavePlaced;
    // The whole deck, not the tray — a card lifted back off the board is held
    // but no longer in the tray. See the same note in AniRankRound.
    const selectedItem = room.deck.find((c) => c.id === selectedId) ?? null;

    const handlePlace = (slotIndex) => {
      if (!open) return room.place(slotIndex);
      if (!selectedId) return;
      room.placeCard(selectedId, slotIndex);
      setSelectedId(null);
    };

    // Tapping a filled slot: put down what you are holding (swapping the two),
    // or lift this one out if your hands are empty.
    const handlePickUp = (slotIndex) => {
      const card = room.myBoard[slotIndex];
      if (!card) return;
      if (selectedId === card.id) return setSelectedId(null);
      if (selectedId) {
        room.placeCard(selectedId, slotIndex);
        return setSelectedId(null);
      }
      setSelectedId(card.id);
    };

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

          {open
            ? !committed && (
              <CardTray items={room.tray} selectedId={selectedId} onSelect={setSelectedId} />
            )
            : <CurrentItem item={room.item} index={room.cursor} total={room.deck.length} />}

          <p className="mb-2 text-center text-base font-bold text-white/70">
            {/* The subject ranks for real — they are the answer key, so telling
                them to guess at themselves would be nonsense. */}
            {isOpinion(room.axis) && room.subjectId === room.myPlayerId
              ? 'You’re the subject — rank these honestly. Everyone else is guessing at you.'
              : promptFor(room.axis, room.subject?.name ?? 'they')}
          </p>

          {committed ? (
            <>
              <p className="mb-2 text-center font-display text-lg font-extrabold text-pop-lime">
                Locked in ✓
              </p>
              <WaitingOn names={room.pendingNames} />
            </>
          ) : (
            <p className="mb-4 text-center text-base text-white/50">
              {open
                ? 'Tap a card then a slot. Tap two slots to swap them — nothing counts until you lock in.'
                : 'Pick a slot. Once it is placed it cannot be moved.'}
            </p>
          )}

          <RankBoard
            board={room.myBoard}
            item={open ? selectedItem : room.item}
            selectedId={open ? selectedId : null}
            disabled={committed}
            topLabel={room.axis.topLabel}
            bottomLabel={room.axis.bottomLabel}
            onPlace={handlePlace}
            onClear={open ? room.clearSlot : undefined}
            onPickUp={open ? handlePickUp : undefined}
          />

          {open && !committed && (
            <LockInButton
              ready={room.boardFull}
              onLockIn={() => { room.lockIn(); setSelectedId(null); }}
            />
          )}
        </Screen>
      </>
    );
  }

  if (room.view === 'results' && room.game) {
    return shell(
      <AniRankResults
        players={room.players}
        boards={room.game.boards}
        deck={room.deck}
        axis={room.axis}
        subjectId={room.subjectId}
        scoring={room.scoring}
        totalScores={room.totalScores}
        // Online only: totalScores is the running room total, so without this a
        // player cannot tell what the round they just finished was worth.
        roundScores={room.roundScores}
        departedIds={room.departedIds}
        onPlayAgain={room.returnToLobby}
        playAgainLabel="🔁 Back to lobby"
      />
    );
  }

  return shell(<WaitingScreen emoji="🌐" title="Loading…" />);
}
