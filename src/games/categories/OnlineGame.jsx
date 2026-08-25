import { useCategoriesRoom } from './hooks/useCategoriesRoom';
import { useCustomCategories } from './hooks/useCustomCategories';
import RoomSetup from '../../shared/components/RoomSetup';
import OnlineLobby from './components/OnlineLobby';
import PickPhase from './components/PickPhase';
import TurnScreen from './components/TurnScreen';
import TurnEnd from './components/TurnEnd';
import RoundEnd from './components/RoundEnd';
import AniTagResults from './components/AniTagResults';
import WaitingScreen from '../aniguess/components/WaitingScreen';
import { Banner, HubButton, Screen } from '../../shared/ui';
import { POOL_LABELS } from './prefs';
import { getCategory, suggestionsFor } from './categories';

// The online view-router. Same shape as src/games/wavelength/OnlineGame.jsx: a
// shell() wraps every in-room screen with the room code, a way out and the
// sync-error banner, and room.view picks the screen.
export default function OnlineGame({ onBack, onExit }) {
  const room = useCategoriesRoom();
  // This device's own written categories, offered at the top of the picker in
  // chosen mode. Read here rather than out of the room for the reason the hook
  // gives: a player's list never enters room state, so only the clause they
  // actually pick is ever published.
  const { categories: myCustom } = useCustomCategories();

  if (!room.roomCode) {
    return (
      <>
        <HubButton onClick={onExit} />
        {/* No `stat`, and unlike AniWave's this is unconditional rather than a
            judgement call about which mode the host might pick: nothing in this
            game reads an anime list, so any number about one shown here would
            read as a requirement that does not exist. */}
        <RoomSetup room={room} onBack={onBack} tone="lime" />
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
        {/* Visible at every width. It used to be `hidden sm:inline`, which hid
            the room code on precisely the device most likely to be handed to
            somebody who has to type it in. */}
        <span className="font-display text-xs tracking-widest text-white/40">
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
        {/* Says out loud why the round has paused, and for how much longer, so
            a dropped player doesn't just look like a frozen game.
            CAPPED AT TWO: this is a fixed overlay sitting on top of the screen's
            own header, so an unbounded stack of them covers the thing the table
            is trying to read. Three people dropping at once is one fact anyway. */}
        {room.dropping.slice(0, 2).map(({ player, remainingMs }) => (
          <Banner key={player.id} tone="warning" className="bg-canvas/95 backdrop-blur-sm">
            🔌 {player.name} disconnected — waiting {Math.ceil(remainingMs / 1000)}s…
          </Banner>
        ))}
        {room.dropping.length > 2 && (
          <Banner tone="warning" className="bg-canvas/95 backdrop-blur-sm">
            🔌 …and {room.dropping.length - 2} more disconnected.
          </Banner>
        )}
      </div>
      {children}
    </div>
  );

  if (!room.view) return shell(<WaitingScreen emoji="🌐" title="Loading room…" />);
  if (room.view === 'lobby') return shell(<OnlineLobby room={room} />);

  if (room.view === 'round' && room.game) {
    const { game } = room;
    const noun = (POOL_LABELS[room.settings?.categoryPool] ?? POOL_LABELS.characters).noun;
    const seatName = room.seat?.name ?? 'Someone';
    const nameFor = (id) => room.players.find((p) => p.id === id)?.name ?? 'Someone';

    // CHOSEN MODE opens here: nobody can name anything until everyone still in
    // the room has committed a clause. This device picks its own and nothing
    // else — there is no dealer in this mode — and then waits, by name.
    if (game.phase === 'picking') {
      return shell(
        <Screen>
          <PickPhase
            playerName={room.myName}
            suggestions={suggestionsFor(
              room.settings?.categoryPool,
              room.settings?.useCustom === false ? [] : myCustom,
            )}
            noun={noun}
            done={room.iHavePicked}
            waitingOn={room.pendingPickers}
            picked={room.activeIds.length - room.pendingPickers.length}
            total={room.activeIds.length}
            onPick={room.pickCategory}
          />
        </Screen>
      );
    }

    if (game.phase === 'roundEnd') {
      return shell(
        <Screen>
          <RoundEnd
            explain={room.explain}
            players={room.players}
            roundNumber={room.roundNumber}
            totalRounds={room.totalRounds}
            isFinalRound={room.isFinalRound}
            chosen={room.chosen}
            // Only the host advances the room. Everyone else reads the same
            // screen with the buttons replaced by a line saying who they are
            // waiting on — rendered here rather than inside RoundEnd so that
            // screen stays the same dumb component local play uses.
            canAdvance={room.isHost}
            hostName={room.hostName}
            onNext={room.nextRound}
            onFinish={room.finish}
          />
        </Screen>
      );
    }

    if (game.phase === 'turnEnd') {
      const seatId = game.seatId;
      const row = room.explain.find((r) => r.playerId === seatId);
      // CHOSEN: what may be shown is the TARGET's clause, and only once the
      // seat claimed them — rules.revealAllowed is what decides, and its owner
      // is the only device that can publish it. DEALT: the seat's own, which
      // any other device publishes onto the result.
      const targetRow = room.chosen && row?.targetId
        ? room.explain.find((r) => r.playerId === row.targetId)
        : null;
      const shown = room.chosen ? targetRow?.category : row?.category;
      return shell(
        <Screen>
          <TurnEnd
            seatName={seatName}
            isYou={room.iAmSeat}
            chosen={room.chosen}
            targetName={row?.targetId ? nameFor(row.targetId) : null}
            order={room.order}
            trails={room.trails}
            seatId={seatId}
            myPlayerId={room.myPlayerId}
            usedFor={room.usedFor}
            // From the published value, never from this device's own read:
            // whichever mode is running, exactly one device is denied the
            // clause and the published copy is the only source that works on
            // all of them. Null for a beat while that device publishes it.
            // Resolved through getCategory because what is stored is a SPEC: a
            // built-in's id or a written category's whole definition.
            category={shown ? getCategory(shown) : null}
            result={game.results?.[seatId] ?? null}
            points={row?.points ?? 0}
            cap={room.cap}
            nameFor={nameFor}
            // Any device may move the seat on. The turn is over and its result
            // is written, so there is nothing left for one device to own — and
            // making it host-only would stall the room every time the host is
            // the person whose turn just ended and who is still reading it.
            canAdvance
            isLastSeat={room.activeIds.every((id) => id === seatId || game.results?.[id])}
            onNext={room.nextTurn}
          />
        </Screen>
      );
    }

    // DEALT ONLY: everyone but the hot seat is waiting on the deal to land in
    // assignments/. The seat needs nothing, so they never see this — and in
    // chosen mode nobody does, because there is no deal and the `picking` phase
    // above is the gate instead.
    if (!room.dealReady) {
      return shell(<WaitingScreen emoji="🏷️" title="Dealing the categories…" />);
    }

    return shell(
      <Screen>
        <TurnScreen
          seatName={seatName}
          roundNumber={room.roundNumber}
          totalRounds={room.totalRounds}
          noun={noun}
          phase={game.phase}
          pending={room.pending}
          // Every trail and the whole rotation — see LocalSession for why one
          // trail stopped being enough the moment the seat started moving.
          trails={room.trails}
          order={room.order}
          lastPlayed={room.lastPlayed}
          cap={room.cap}
          left={room.left}
          usedFor={room.usedFor}
          myPlayerId={room.myPlayerId}
          chosen={room.chosen}
          // DEALT: null on the hot seat's own device — by a Firebase rule
          // rather than by this line — and the resolved clause on every other.
          // CHOSEN: the mirror, null on every device but its owner's. No peek
          // in either: online, the device that must not show a clause does not
          // have it, so there is nothing to hide behind a control.
          category={room.seatCategory}
          myCategory={room.myCategory}
          canName={room.iAmSeat}
          // At most one, and only while this device actually owes an answer.
          // Locally the same prop carries the whole table — see LocalSession.
          rulers={room.iMustRule ? [{ id: room.myPlayerId, name: room.myName }] : []}
          pendingJudges={room.pendingJudges}
          declarable={room.declarable}
          nameFor={nameFor}
          onPropose={room.propose}
          onDeclare={room.declare}
          // The judge id is this device's by construction, so it is thrown
          // away here — room.rule reads myPlayerId itself.
          onRule={(_judgeId, verdict) => room.rule(verdict)}
          onPass={room.pass}
          // The wedge presence cannot see: a hot seat who is connected and
          // simply not naming anything. usePresence notices a device that
          // DISCONNECTS and has nothing to say about one that is connected and
          // idle, so an untimed round would wait forever. It sits on the HOST
          // because the case it covers is the seat having stopped responding —
          // and unlike AniWave's reveal it needs no secret, so the host can hold
          // it. The seat's own "give up" is the same escape from their side.
          //
          // Passed INTO the screen rather than rendered under it, so it inherits
          // the width instead of re-declaring max-w-md, and so it reads as the
          // escape hatch it is rather than as part of the turn controls.
          onAbandon={room.isHost && !room.iAmSeat ? () => {
            if (!window.confirm(
              `End ${seatName}'s round? It scores nothing and everyone keeps the points they have.`,
            )) return;
            room.abandonTurn();
          } : null}
        />
      </Screen>
    );
  }

  if (room.view === 'results') {
    return shell(
      <AniTagResults
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
