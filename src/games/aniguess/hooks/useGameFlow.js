import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameSession } from './useGameSession';
import { useWins } from '../../../shared/hooks/useWins';
import * as rules from '../rules';

// Views that describe a game actually in progress. The list-editing and
// menu screens are deliberately excluded: saving one of those would offer to
// "resume" into a screen that has no game state behind it.
export const RESUMABLE_VIEWS = ['assignment', 'reveal', 'game', 'correctGuess', 'roundEnd'];

// Owns all game-flow state (assignment, turns, scoring, session persistence).
// `view`/`setView` stay owned by LocalGame.jsx, which remains the thin view-router;
// handlers here call setView to navigate between screens. The actual turn/
// scoring/assignment computations live in src/games/aniguess/rules.js (pure, backend-
// free) so the same logic can back an online (Firebase) equivalent hook
// without duplicating it.
export function useGameFlow({ view, setView }) {
  const [gameSession, setGameSession] = useState(null);

  // Assignment phase — track which player we're currently assigning to
  const [assignmentIndex, setAssignmentIndex] = useState(0);
  const [assignments, setAssignments] = useState([]); // { playerId, character }

  // Game loop
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [lockedPositions, setLockedPositions] = useState([]); // { playerId, name, position, points, turnsUsed }
  const [peekedPlayers, setPeekedPlayers] = useState([]);
  const [questionLogs, setQuestionLogs] = useState({}); // { playerId: [...log entries] }
  const [turnCounts, setTurnCounts] = useState({}); // { playerId: number }

  // Scoring
  const [roundNumber, setRoundNumber] = useState(1);
  const [totalScores, setTotalScores] = useState({});

  // Persistence
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const { saveSession, loadSession, clearSession } = useGameSession();
  const { recordWin } = useWins();

  // Check for saved session on load — intentionally mount-only, not
  // reactive to loadSession/clearSession (which never change anyway).
  useEffect(() => {
    const existing = loadSession();
    if (!existing) return;
    if (Array.isArray(existing.assignments) && existing.gameSession?.players?.length
        && RESUMABLE_VIEWS.includes(existing.view)) {
      setSavedSession(existing);
      setShowResumePrompt(true);
    } else {
      // Doesn't look like a valid session shape — discard rather than
      // offering to resume into a broken state.
      clearSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save session
  useEffect(() => {
    if (gameSession && RESUMABLE_VIEWS.includes(view)) {
      saveSession({
        view, gameSession, assignmentIndex, assignments,
        currentPlayerIndex, lockedPositions, peekedPlayers,
        questionLogs, turnCounts, roundNumber, totalScores,
      });
    }
  }, [view, gameSession, assignmentIndex, assignments, currentPlayerIndex,
      lockedPositions, peekedPlayers, questionLogs, turnCounts, roundNumber, totalScores, saveSession]);

  const handleResumeSession = useCallback(() => {
    const s = savedSession;
    setView(s.view);
    setGameSession(s.gameSession);
    setAssignmentIndex(s.assignmentIndex);
    setAssignments(s.assignments);
    setCurrentPlayerIndex(s.currentPlayerIndex);
    setLockedPositions(s.lockedPositions);
    setPeekedPlayers(s.peekedPlayers);
    setQuestionLogs(s.questionLogs);
    setTurnCounts(s.turnCounts);
    setRoundNumber(s.roundNumber);
    setTotalScores(s.totalScores);
    setShowResumePrompt(false);
    setSavedSession(null);
  }, [savedSession, setView]);

  const handleDiscardSession = useCallback(() => {
    clearSession();
    setShowResumePrompt(false);
    setSavedSession(null);
  }, [clearSession]);

  const handleStartGame = useCallback((session) => {
    clearSession();
    const initial = rules.startGame(session);
    setGameSession(initial.gameSession);
    setAssignmentIndex(initial.assignmentIndex);
    setAssignments(initial.assignments);
    setCurrentPlayerIndex(initial.currentPlayerIndex);
    setLockedPositions(initial.lockedPositions);
    setPeekedPlayers(initial.peekedPlayers);
    setQuestionLogs(initial.questionLogs);
    setTurnCounts(initial.turnCounts);
    setRoundNumber(initial.roundNumber);
    setTotalScores(initial.totalScores);
    setView('assignment');
  }, [clearSession, setView]);

  // Called when a character is assigned to the current player in assignment phase
  const handleCharacterAssigned = useCallback((character) => {
    const { assignments: newAssignments } = rules.characterAssigned(
      { gameSession, assignmentIndex, assignments }, character
    );
    setAssignments(newAssignments);
    setView('reveal');
  }, [gameSession, assignmentIndex, assignments, setView]);

  // Called after reveal — move to next player assignment or start game
  const handleRevealDone = useCallback(() => {
    const { patch, next } = rules.revealDone({ gameSession, assignmentIndex });
    if ('currentPlayerIndex' in patch) setCurrentPlayerIndex(patch.currentPlayerIndex);
    if ('assignmentIndex' in patch) setAssignmentIndex(patch.assignmentIndex);
    setView(next);
  }, [assignmentIndex, gameSession, setView]);

  // Called when current player asks a question (question + answer already logged)
  const handleTurnComplete = useCallback((logEntry) => {
    const { patch } = rules.turnComplete(
      { gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts }, logEntry
    );
    setQuestionLogs(patch.questionLogs);
    setTurnCounts(patch.turnCounts);
    setCurrentPlayerIndex(patch.currentPlayerIndex);
  }, [gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts]);

  // Called when current player guesses correctly
  const handleCorrectGuess = useCallback((logEntry) => {
    const { patch } = rules.correctGuess(
      { gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts }, logEntry
    );
    setQuestionLogs(patch.questionLogs);
    setTurnCounts(patch.turnCounts);
    setLockedPositions(patch.lockedPositions);
    if ('currentPlayerIndex' in patch) setCurrentPlayerIndex(patch.currentPlayerIndex);
    setView('correctGuess');
  }, [gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts, setView]);

  // Called when current player guesses wrong — just advance turn
  const handleWrongGuess = useCallback((logEntry) => {
    const { patch } = rules.wrongGuess(
      { gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts }, logEntry
    );
    setQuestionLogs(patch.questionLogs);
    setTurnCounts(patch.turnCounts);
    if ('currentPlayerIndex' in patch) setCurrentPlayerIndex(patch.currentPlayerIndex);
  }, [gameSession, currentPlayerIndex, lockedPositions, questionLogs, turnCounts]);

  const finishRound = useCallback((locked) => {
    setTotalScores((prev) => rules.applyRoundScores(prev, locked));
    setView('roundEnd');
  }, [setView]);

  const handlePeek = useCallback(() => {
    const player = gameSession.players[currentPlayerIndex];
    setPeekedPlayers((prev) => [...prev, player.id]);
  }, [gameSession, currentPlayerIndex]);

  const handleNewRound = useCallback(() => {
    const { patch, next } = rules.newRound({ gameSession, roundNumber });
    setAssignmentIndex(patch.assignmentIndex);
    setAssignments(patch.assignments);
    setCurrentPlayerIndex(patch.currentPlayerIndex);
    setLockedPositions(patch.lockedPositions);
    setPeekedPlayers(patch.peekedPlayers);
    setQuestionLogs(patch.questionLogs);
    setTurnCounts(patch.turnCounts);
    setRoundNumber(patch.roundNumber);
    setView(next);
  }, [gameSession, roundNumber, setView]);

  const handleEndSession = useCallback(() => {
    clearSession();
    const { winners } = rules.computeSessionEnd(totalScores, gameSession.players);
    winners.forEach((name) => recordWin(name));
    setView('leaderboard');
  }, [clearSession, totalScores, gameSession, recordWin, setView]);

  // Current state helpers
  const currentGuesser = gameSession?.players[currentPlayerIndex];
  const currentAssignment = useMemo(
    () => assignments.find((a) => a.playerId === currentGuesser?.id),
    [assignments, currentGuesser]
  );
  const hasPeeked = peekedPlayers.includes(currentGuesser?.id);
  const lastLocked = lockedPositions[lockedPositions.length - 1];
  const assignmentPlayer = gameSession?.players[assignmentIndex];
  const assignmentCharacter = useMemo(
    () => assignments.find((a) => a.playerId === assignmentPlayer?.id),
    [assignments, assignmentPlayer]
  );

  return {
    gameSession, setGameSession,
    assignmentIndex, assignments,
    currentPlayerIndex, lockedPositions, peekedPlayers, questionLogs, turnCounts,
    roundNumber, totalScores,
    showResumePrompt, savedSession,
    handleResumeSession, handleDiscardSession,
    handleStartGame, handleCharacterAssigned, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    currentGuesser, currentAssignment, hasPeeked, lastLocked,
    assignmentPlayer, assignmentCharacter,
  };
}
