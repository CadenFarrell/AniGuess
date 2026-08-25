import { useEffect, useState } from 'react';
import { useWavelengthRoom } from './hooks/useWavelengthRoom';
import RoomSetup from '../../shared/components/RoomSetup';
import OnlineLobby from './components/OnlineLobby';
import PsychicView from './components/PsychicView';
import GuessView from './components/GuessView';
import RevealScreen from './components/RevealScreen';
import WavelengthResults from './components/WavelengthResults';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Banner, Button, HubButton, Screen } from '../../shared/ui';

// The online view-router. Same shape as src/games/anifake/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useWavelengthRoom();
  // The dial before it is committed. Kept out of the room deliberately: writing
  // every drag would mark this player as having dialled the instant they touched
  // the bar, ending the guess phase for everyone while they were still thinking.
  const [draft, setDraft] = useState(null);

  // A draft belongs to ONE round, and clearing it at each of the places a round
  // can end is how it goes stale: the auto-lock below deliberately leaves it
  // set, and "next round" is a host-only button, so a guest's draft used to ride
  // into the following round and pre-place their dial — an answer the game
  // supplied, which is the one thing GuessView's header says must not happen.
  // Resetting DURING RENDER against the round number covers every ending at
  // once, and is the pattern RevealScreen's useCountUp uses to clear itself.
  const roundIndex = room.game?.round ?? null;
  const [draftRound, setDraftRound] = useState(roundIndex);
  if (draftRound !== roundIndex) {
    setDraftRound(roundIndex);
    setDraft(null);
  }

  // AUTO-LOCK: a placed dial goes in when the clock runs out.
  //
  // Here rather than in GuessView because the guard is real state — once the
  // write lands `iHaveDialled` is true and this stops, with no latch to keep in
  // step — and because a network write from an effect is an ordinary side
  // effect, where the equivalent latch down there is either a ref read during
  // render or a setState in an effect. The psychic's device waits
  // REVEAL_GRACE_MS past the same deadline before publishing the target, which
  // is the window this write lands in; see useWavelengthRoom.
  //
  // The draft is NOT cleared: the screen keeps saying the dial went in, and the
  // round-number reset above is what eventually clears it.
  const { placeDial, iHaveDialled, iAmPsychic } = room;
  const dialsExpired = room.timer?.expired === true;
  useEffect(() => {
    if (!dialsExpired || iHaveDialled || iAmPsychic) return;
    if (!Number.isFinite(draft)) return;
    placeDial(draft);
  }, [dialsExpired, draft, iHaveDialled, iAmPsychic, placeDial]);

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        {/* No `stat`. Two of the three clue modes do deal cards now, but the
            join screen cannot know which one the host will pick, and a list
            count shown here would read as a requirement in the mode that has
            none. The lobby badges the exact players who need one, once the
            mode is actually chosen. */}
        <RoomSetup room={room} onBack={onBack} tone="purple" />
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

  const nameOf = (id) => room.players.find((p) => p.id === id)?.name ?? 'Someone';
  const waitingOn = room.pending.map((id) => nameOf(id)).join(', ');

  // --- the two manual endings ------------------------------------------------
  //
  // Both exist for the wedge presence cannot see. usePresence notices a device
  // that DISCONNECTS; it has nothing to say about one that is connected and
  // simply not acting, and a player reading their phone is indistinguishable
  // from one thinking hard about a clue. Without these, an untimed round waits
  // on them forever.
  //
  // EACH SITS ON THE ONLY DEVICE THAT CAN PERFORM IT, which is not a UI choice.
  // A reveal needs the target and the psychic is its sole holder, so "reveal
  // now" cannot be a host control however convenient that would be. Abandoning
  // needs no secret at all, so it belongs to the host — and has to, since the
  // case it covers is the psychic being the one who stopped responding.
  //
  // The limit worth stating rather than papering over: if the host IS the
  // stalled psychic, neither button has a live device behind it and only
  // presence recovers the room. That is the same concession abandonRound
  // already documents, arrived at from the other side.
  const abandonButton = room.isHost ? (
    <Button
      variant="danger"
      size="lg"
      fullWidth
      onClick={() => {
        if (!window.confirm(
          'Abandon this round? It scores nothing and everyone keeps the points they already have.',
        )) return;
        room.abandon();
      }}
    >
      Abandon this round
    </Button>
  ) : null;

  const revealNowButton = room.canRevealNow ? (
    <Button
      variant="secondary"
      size="lg"
      fullWidth
      onClick={() => {
        // Names them, because this is the one control that decides for someone
        // else. "Reveal now" with no list reads as ending your own wait.
        if (!window.confirm(waitingOn
          ? `Reveal now? ${waitingOn} has not dialled and will score nothing.`
          : 'Reveal now?')) return;
        room.revealNow();
      }}
    >
      Reveal now
    </Button>
  ) : null;

  if (room.view === 'round' && room.game) {
    const { game } = room;

    if (game.phase === 'clue') {
      if (!room.iAmPsychic) {
        return shell(
          <WaitingScreen
            emoji="🔮"
            title={`${nameOf(game.psychicId)} is the psychic`}
            subtitle={game.mode === 'readroom'
              ? "They're deciding where their card belongs…"
              : "They're looking at the target and thinking of a clue…"}
          >
            {abandonButton}
          </WaitingScreen>
        );
      }
      // The target — and in readroom the card — is drawn by this device and
      // written to secrets/; there is a beat before the write lands and comes
      // back through the listener. Gated on myDealReady rather than on the
      // target, because in readroom there is no target to wait for. In `cards`
      // there is nothing to deal at all: the pool is searched, not dealt, so
      // only the target holds this up.
      if (!room.myDealReady) {
        return shell(<WaitingScreen emoji="🎯" title="Dealing you in…" />);
      }
      return shell(
        <PsychicView
          mode={game.mode}
          target={room.myTarget}
          hand={room.myHand}
          cards={room.searchCards}
          cardPool={room.settings?.cardPool}
          excludeId={game.excludeSpectrumId}
          roundNumber={room.roundNumber}
          totalRounds={room.totalRounds}
          onSubmit={room.submitClue}
        />
      );
    }

    if (game.phase === 'guess') {
      if (room.iAmPsychic) {
        return shell(
          <WaitingScreen
            emoji="⏳"
            title="Your clue is out"
            subtitle={waitingOn ? `Still dialling: ${waitingOn}` : 'Everyone has dialled…'}
          >
            {/* Only while somebody is still out: once the last dial lands the
                reveal is already on its way, and a button that races it would
                do nothing on the happy path and confuse on every other. */}
            {waitingOn ? revealNowButton : null}
          </WaitingScreen>
        );
      }
      if (room.iHaveDialled) {
        return shell(
          <WaitingScreen
            emoji="✅"
            title="Dial locked in"
            subtitle={waitingOn ? `Waiting on: ${waitingOn}` : 'Revealing…'}
          >
            {/* The host is a guesser this round, so the only ending they can
                reach from here is the one that needs no target. */}
            {waitingOn ? abandonButton : null}
          </WaitingScreen>
        );
      }
      return shell(
        <GuessView
          spectrum={room.spectrum}
          mode={game.mode}
          clue={game.clue}
          card={game.card}
          psychicName={room.psychic?.name}
          value={draft}
          timer={room.timer}
          waitingFor={room.pending.length > 1 ? `${room.pending.length} still to guess` : null}
          onChange={setDraft}
          // Leaves the draft alone, so the dial does not blink back to "—"
          // while the write is in flight. The round-number reset owns clearing it.
          onLock={() => room.placeDial(draft)}
        />
      );
    }

    return shell(
      <RevealScreen
        spectrum={room.spectrum}
        mode={game.mode}
        card={game.card}
        target={room.revealedTarget}
        explain={room.explain}
        players={room.players}
        psychic={room.psychic}
        roundScores={room.roundScores}
        abandoned={game.abandoned}
        isFinalRound={room.isFinalRound}
        // Only the host advances the room. Everyone else reads the same screen
        // with the buttons replaced by a line saying who they are waiting on —
        // rendered here rather than inside RevealScreen so that screen stays the
        // same dumb component local play uses.
        onNext={room.isHost ? room.nextRound : null}
        onResults={room.isHost ? room.finish : null}
        waitingFor={room.isHost ? null : `Waiting for ${room.hostName || 'the host'}…`}
      />
    );
  }

  if (room.view === 'results') {
    return shell(
      <WavelengthResults
        players={room.players}
        totalScores={room.totalScores}
        onPlayAgain={room.isHost ? room.returnToLobby : null}
        playAgainLabel="🔁 Back to lobby"
        onBack={handleExitToHub}
        backLabel="🏠 Leave the room"
      />
    );
  }

  return shell(<WaitingScreen emoji="🌐" title="Loading…" />);
}
