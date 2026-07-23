import { useState, useEffect, useRef } from 'react';
import { useRoom } from './hooks/useRoom';
import { useWins } from '../../shared/hooks/useWins';
import { isCorrectGuess } from './utils/guessMatch';
import RoomSetup from './components/RoomSetup';
import OnlineLobby from './components/OnlineLobby';
import OnlineCharacterAssignment from './components/OnlineCharacterAssignment';
import CharacterReveal from './components/CharacterReveal';
import OnlineGameScreen from './components/OnlineGameScreen';
import OnlineAnswererView from './components/OnlineAnswererView';
import CorrectGuessScreen from './components/CorrectGuessScreen';
import RoundEnd from './components/RoundEnd';
import Leaderboard from './components/Leaderboard';
import WaitingScreen from './components/WaitingScreen';
import { Banner, HubButton } from '../../shared/ui';

export default function OnlineGame({ onBack, onExit }) {
  const room = useRoom();
  const { recordWin } = useWins();
  const [revealCharacter, setRevealCharacter] = useState(null);
  const [guesserCharacter, setGuesserCharacter] = useState(null);
  const [resolving, setResolving] = useState(false);

  // Fetch the character to reveal — only devices that AREN'T the assignee are
  // permitted to read it (enforced server-side by database.rules.json).
  useEffect(() => {
    if (room.view !== 'reveal' || room.isMyAssignmentTurn || !room.assignmentPlayer) {
      setRevealCharacter(null);
      return;
    }
    let cancelled = false;
    room.readAssignment(room.assignmentPlayer.id).then((c) => {
      if (!cancelled) setRevealCharacter(c);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.assignmentPlayer?.id, room.isMyAssignmentTurn]);

  // Answering devices need the guesser's character in front of them for the
  // whole turn — remote players can't lean over and check a shared screen the
  // way local pass-and-play allows, and a round can run for many turns.
  useEffect(() => {
    if (room.view !== 'game' || room.isMyTurn || !room.currentGuesser) {
      setGuesserCharacter(null);
      return;
    }
    let cancelled = false;
    room.readAssignment(room.currentGuesser.id).then((c) => {
      if (!cancelled) setGuesserCharacter(c);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.currentGuesser?.id, room.isMyTurn, room.roundNumber]);

  // Auto-resolve a pending GUESS — no human decision needed, any non-guesser
  // device races to claim it via the transaction-guarded resolvePendingAction;
  // only one instance actually proceeds.
  useEffect(() => {
    if (room.view !== 'game' || room.isMyTurn) return;
    const pending = room.pendingAction;
    if (!pending || pending.resolved || pending.kind !== 'guess') return;

    let cancelled = false;
    (async () => {
      // Once resolvePendingAction() reports we claimed it, that claim itself
      // is durable ownership — do NOT bail out on `cancelled` past this
      // point. The transaction's own successful write updates room.pendingAction
      // (resolved: true), which re-fires this effect and flips `cancelled`
      // via the cleanup below almost immediately; checking it after the
      // claim would abort our own follow-through before it finishes.
      if (cancelled) return;
      const claimed = await room.resolvePendingAction();
      if (!claimed) return;
      // Past this line we own a pendingAction that is already marked resolved,
      // so every exit path must clear it — otherwise the guesser's device waits
      // on an answer that can never arrive.
      try {
        const character = await room.readAssignment(pending.askedBy);
        if (!character) {
          await room.clearPendingAction();
          return;
        }
        const correct = isCorrectGuess(character, pending.text);
        const logEntry = { id: crypto.randomUUID(), type: 'guess', text: pending.text, correct };
        await room.clearPendingAction();
        if (correct) await room.handleCorrectGuess(logEntry);
        else await room.handleWrongGuess(logEntry);
      } catch {
        await room.clearPendingAction();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.isMyTurn, room.pendingAction]);

  // Unanimous approval: once every non-assignee has approved the current shared
  // proposal, lock it in (advance to reveal). Any present device can trigger the
  // write (it's idempotent); the ref guards each device to one trigger per
  // assignment so we don't spam identical writes.
  const lockedForRef = useRef(null);
  useEffect(() => {
    if (room.view !== 'assignment' || room.isMyAssignmentTurn || !room.gameSession) return;
    const prop = room.currentProposal;
    if (!prop?.character) return;
    const needed = room.gameSession.players.length - 1;
    const approved = prop.approvals ? Object.values(prop.approvals).filter(Boolean).length : 0;
    const key = `${room.roundNumber}:${room.assignmentIndex}`;
    if (approved >= needed && lockedForRef.current !== key) {
      lockedForRef.current = key;
      room.lockInAssignment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.view, room.isMyAssignmentTurn, room.currentProposal, room.assignmentIndex, room.roundNumber]);

  if (!room.roomCode) {
    // Not in a room yet, so leaving costs nothing — no confirm.
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

  // Going to the hub from inside a room means leaving it — the room itself
  // survives, so rejoining with the same name and code picks the game back up.
  const handleExitToHub = () => {
    room.leaveRoom();
    onExit();
  };

  const handleAnswerQuestion = async (answer) => {
    setResolving(true);
    try {
      const claimed = await room.resolvePendingAction();
      if (claimed) {
        const logEntry = { id: crypto.randomUUID(), type: 'question', text: claimed.text, answer };
        await room.clearPendingAction();
        await room.handleTurnComplete(logEntry);
      }
    } finally {
      setResolving(false);
    }
  };

  // Wraps every in-room screen so connection problems and the way out are
  // always reachable, whatever phase the game is in.
  const shell = (children) => (
    <div className="relative">
      <HubButton
        onClick={handleExitToHub}
        confirm="Leave this room and return to the hub? You can rejoin with the same name and room code."
      />
      {/* Mirrors HubButton's chrome treatment so the two corners read as one
          layer floating over the screen rather than two unrelated controls. */}
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
      {room.syncError && (
        <div className="fixed top-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2">
          <Banner tone="danger" onDismiss={room.dismissSyncError} className="bg-canvas/95 backdrop-blur-sm">
            ⚠️ {room.syncError}
          </Banner>
        </div>
      )}
      {children}
    </div>
  );

  if (!room.view) {
    return shell(<WaitingScreen emoji="🌐" title="Loading room…" />);
  }

  if (room.view === 'setup') {
    return shell(<OnlineLobby room={room} />);
  }

  if (room.view === 'assignment') {
    if (room.isMyAssignmentTurn) {
      return shell(
        <WaitingScreen
          emoji="📵"
          title="Look away!"
          subtitle="The other players are choosing your character together."
        />
      );
    }
    return shell(
      <OnlineCharacterAssignment
        guesser={room.assignmentPlayer}
        allPlayers={room.gameSession.players}
        sharedShowsOnly={room.gameSession.settings.sharedShowsOnly}
        twoStepRandom={room.gameSession.settings.twoStepRandom}
        currentProposal={room.currentProposal}
        myPlayerId={room.myPlayerId}
        onPropose={room.proposeCharacter}
        onToggleApproval={room.setMyApproval}
        assignmentNumber={room.assignmentIndex + 1}
        totalPlayers={room.gameSession.players.length}
      />
    );
  }

  if (room.view === 'reveal') {
    if (room.isMyAssignmentTurn) {
      return shell(
        <WaitingScreen
          emoji="🙈"
          title="Still looking away!"
          subtitle="The other players are memorizing your character."
        />
      );
    }
    if (!revealCharacter) {
      return shell(<WaitingScreen emoji="⏳" title="Loading character…" />);
    }
    return shell(
      <CharacterReveal
        character={revealCharacter}
        guesserName={room.assignmentPlayer.name}
        onStartQuestioning={room.handleRevealDone}
        isLastPlayer={room.assignmentIndex === room.gameSession.players.length - 1}
        online
      />
    );
  }

  if (room.view === 'game') {
    if (room.isMyTurn) {
      return shell(
        <OnlineGameScreen
          guesser={room.currentGuesser}
          players={room.gameSession.players}
          lockedPositions={room.lockedPositions}
          questionLog={room.questionLogs[room.currentGuesser.id] || []}
          turnCount={room.turnCounts[room.currentGuesser.id] || 0}
          hasPeeked={room.hasPeeked}
          onPeek={room.handlePeek}
          onSubmitQuestion={(text) => room.submitPendingAction('question', text)}
          onSubmitGuess={(text) => room.submitPendingAction('guess', text)}
          pendingAction={room.pendingAction}
          lastOutcome={room.lastOutcome}
          sharedShowsOnly={room.gameSession.settings.sharedShowsOnly ?? true}
        />
      );
    }
    return shell(
      <OnlineAnswererView
        guesser={room.currentGuesser}
        guesserCharacter={guesserCharacter}
        questionLog={room.questionLogs[room.currentGuesser?.id] || []}
        turnCount={room.turnCounts[room.currentGuesser?.id] || 0}
        pendingAction={room.pendingAction}
        lastOutcome={room.lastOutcome}
        onAnswer={handleAnswerQuestion}
        resolving={resolving}
      />
    );
  }

  if (room.view === 'correctGuess' && room.lastLocked) {
    return shell(
      <CorrectGuessScreen
        lastLocked={room.lastLocked}
        lockedPositions={room.lockedPositions}
        onContinue={() => {
          if (room.lockedPositions.length >= room.gameSession.players.length) {
            room.finishRound(room.lockedPositions);
          } else {
            room.setView('game');
          }
        }}
      />
    );
  }

  if (room.view === 'roundEnd') {
    return shell(
      <RoundEnd
        players={room.gameSession.players}
        lockedPositions={room.lockedPositions}
        roundNumber={room.roundNumber}
        totalScores={room.totalScores}
        onNewRound={room.handleNewRound}
        onEndSession={() => room.handleEndSession(recordWin)}
      />
    );
  }

  if (room.view === 'leaderboard') {
    return shell(
      <Leaderboard
        players={room.gameSession.players}
        totalScores={room.totalScores}
        roundNumber={room.roundNumber}
        onPlayAgain={() => { room.leaveRoom(); onBack(); }}
        onEditLists={() => { room.leaveRoom(); onBack(); }}
      />
    );
  }

  return shell(<WaitingScreen emoji="🌐" title="Loading…" />);
}
