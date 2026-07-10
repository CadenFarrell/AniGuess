import { useState, useEffect, useRef } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useWins } from '../hooks/useWins';
import { isCorrectGuess } from '../utils/guessMatch';
import RoomSetup from './RoomSetup';
import OnlineLobby from './OnlineLobby';
import OnlineCharacterAssignment from './OnlineCharacterAssignment';
import CharacterReveal from './CharacterReveal';
import OnlineGameScreen from './OnlineGameScreen';
import OnlineAnswererView from './OnlineAnswererView';
import CorrectGuessScreen from './CorrectGuessScreen';
import RoundEnd from './RoundEnd';
import Leaderboard from './Leaderboard';
import WaitingScreen from './WaitingScreen';

export default function OnlineApp({ onBack }) {
  const room = useRoom();
  const { recordWin } = useWins();
  const [revealCharacter, setRevealCharacter] = useState(null);
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
      const character = await room.readAssignment(pending.askedBy);
      const correct = isCorrectGuess(character, pending.text);
      const logEntry = { id: crypto.randomUUID(), type: 'guess', text: pending.text, correct };
      await room.clearPendingAction();
      if (correct) await room.handleCorrectGuess(logEntry);
      else await room.handleWrongGuess(logEntry);
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
    return <RoomSetup room={room} onBack={onBack} />;
  }

  if (!room.view) {
    return <WaitingScreen emoji="🌐" title="Loading room…" />;
  }

  const handleAnswerQuestion = async (answer) => {
    setResolving(true);
    const claimed = await room.resolvePendingAction();
    if (claimed) {
      const logEntry = { id: crypto.randomUUID(), type: 'question', text: claimed.text, answer };
      await room.clearPendingAction();
      await room.handleTurnComplete(logEntry);
    }
    setResolving(false);
  };

  if (room.view === 'setup') {
    return <OnlineLobby room={room} />;
  }

  if (room.view === 'assignment') {
    if (room.isMyAssignmentTurn) {
      return (
        <WaitingScreen
          emoji="📵"
          title="Look away!"
          subtitle="The other players are choosing your character together."
        />
      );
    }
    return (
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
      return (
        <WaitingScreen
          emoji="🙈"
          title="Still looking away!"
          subtitle="The other players are memorizing your character."
        />
      );
    }
    if (!revealCharacter) {
      return <WaitingScreen emoji="⏳" title="Loading character…" />;
    }
    return (
      <CharacterReveal
        character={revealCharacter}
        guesserName={room.assignmentPlayer.name}
        onStartQuestioning={room.handleRevealDone}
        isLastPlayer={room.assignmentIndex === room.gameSession.players.length - 1}
      />
    );
  }

  if (room.view === 'game') {
    if (room.isMyTurn) {
      return (
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
          sharedShowsOnly={room.gameSession.settings.sharedShowsOnly ?? true}
        />
      );
    }
    return (
      <OnlineAnswererView
        guesser={room.currentGuesser}
        pendingAction={room.pendingAction}
        onAnswer={handleAnswerQuestion}
        resolving={resolving}
      />
    );
  }

  if (room.view === 'correctGuess' && room.lastLocked) {
    return (
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
    return (
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
    return (
      <Leaderboard
        players={room.gameSession.players}
        totalScores={room.totalScores}
        roundNumber={room.roundNumber}
        onPlayAgain={() => { room.leaveRoom(); onBack(); }}
        onEditLists={() => { room.leaveRoom(); onBack(); }}
      />
    );
  }

  return <WaitingScreen emoji="🌐" title="Loading…" />;
}
