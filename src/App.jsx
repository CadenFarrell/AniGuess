import { useState, useEffect } from 'react';
import ListManager from './components/ListManager';
import PlayerSetup from './components/PlayerSetup';
import CharacterAssignment from './components/CharacterAssignment';
import CharacterReveal from './components/CharacterReveal';
import GameScreen from './components/GameScreen';
import RoundEnd from './components/RoundEnd';
import Leaderboard from './components/Leaderboard';
import { useGameSession } from './hooks/useGameSession';

function App() {
  const [view, setView] = useState('setup');
  const [listManagerProfile, setListManagerProfile] = useState(null);
  const [listManagerOrigin, setListManagerOrigin] = useState('setup');
  const [gameSession, setGameSession] = useState(null);
  const [setupPlayers, setSetupPlayers] = useState([]);

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

  // Check for saved session on load
  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      setSavedSession(existing);
      setShowResumePrompt(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save session
  useEffect(() => {
    if (gameSession && view !== 'setup' && view !== 'leaderboard') {
      saveSession({
        view, gameSession, assignmentIndex, assignments,
        currentPlayerIndex, lockedPositions, peekedPlayers,
        questionLogs, turnCounts, roundNumber, totalScores,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, gameSession, assignmentIndex, assignments, currentPlayerIndex,
      lockedPositions, peekedPlayers, questionLogs, turnCounts, roundNumber, totalScores]);

  const handleResumeSession = () => {
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
  };

  const handleDiscardSession = () => {
    clearSession();
    setShowResumePrompt(false);
    setSavedSession(null);
  };

  const handleProfileUpdated = (updatedProfile) => {
    // Keep the ListManager in sync so changes appear immediately
    setListManagerProfile(updatedProfile);
    // Keep setup player list in sync so edits appear without refresh
    setSetupPlayers((prev) => prev.map((p) => p.id === updatedProfile.id ? updatedProfile : p));
    if (gameSession) {
      const updatedPlayers = gameSession.players.map((p) =>
        p.id === updatedProfile.id ? updatedProfile : p
      );
      setGameSession({ ...gameSession, players: updatedPlayers });
    }
  };

  const handleStartGame = (session) => {
    clearSession();
    setGameSession(session);
    setAssignmentIndex(0);
    setAssignments([]);
    setCurrentPlayerIndex(0);
    setLockedPositions([]);
    setPeekedPlayers([]);
    setQuestionLogs({});
    setTurnCounts(
      Object.fromEntries(session.players.map((p) => [p.id, 0]))
    );
    setRoundNumber(1);
    setTotalScores({});
    setView('assignment');
  };

  const handleGoToList = (profile) => {
    setListManagerProfile(profile);
    setListManagerOrigin(gameSession ? 'leaderboard' : 'setup');
    setView('listManager');
  };

  // Called when a character is assigned to the current player in assignment phase
  const handleCharacterAssigned = (character) => {
    const player = gameSession.players[assignmentIndex];
    const newAssignments = [...assignments, { playerId: player.id, character }];
    setAssignments(newAssignments);
    setView('reveal');
  };

  // Called after reveal — move to next player assignment or start game
  const handleRevealDone = () => {
    const nextIndex = assignmentIndex + 1;
    if (nextIndex >= gameSession.players.length) {
      setCurrentPlayerIndex(0);
      setView('game');
    } else {
      setAssignmentIndex(nextIndex);
      setView('assignment');
    }
  };

  // Get next non-locked player index after current
  const getNextPlayerIndex = (fromIndex, locked) => {
    const total = gameSession.players.length;
    for (let i = 1; i <= total; i++) {
      const idx = (fromIndex + i) % total;
      const player = gameSession.players[idx];
      if (!locked.find((lp) => lp.playerId === player.id)) {
        return idx;
      }
    }
    return -1; // All locked
  };

  // Called when current player asks a question (question + answer already logged)
  const handleTurnComplete = (logEntry) => {
    const player = gameSession.players[currentPlayerIndex];

    setQuestionLogs((prev) => ({
      ...prev,
      [player.id]: [logEntry, ...(prev[player.id] || [])],
    }));

    setTurnCounts((prev) => ({
      ...prev,
      [player.id]: (prev[player.id] || 0) + 1,
    }));

    const next = getNextPlayerIndex(currentPlayerIndex, lockedPositions);
    if (next === -1) {
      finishRound(lockedPositions);
    } else {
      setCurrentPlayerIndex(next);
    }
  };

  // Called when current player guesses correctly
  const handleCorrectGuess = (logEntry) => {
    const player = gameSession.players[currentPlayerIndex];
    const turnsUsed = (turnCounts[player.id] || 0) + 1;

    const playersWithFewerTurns = lockedPositions.filter(
      (lp) => lp.turnsUsed < turnsUsed
    ).length;
    const position = playersWithFewerTurns + 1;
    const points = gameSession.settings.pointsPerPosition[position - 1] || 0;

    const newLocked = [...lockedPositions, {
      playerId: player.id,
      name: player.name,
      position,
      points,
      turnsUsed,
    }];

    setQuestionLogs((prev) => ({
      ...prev,
      [player.id]: [logEntry, ...(prev[player.id] || [])],
    }));

    setTurnCounts((prev) => ({
      ...prev,
      [player.id]: turnsUsed,
    }));

    setLockedPositions(newLocked);

    // Always show the celebration screen — the Continue button will
    // decide whether to go back to the game or finish the round.
    const next = getNextPlayerIndex(currentPlayerIndex, newLocked);
    if (next !== -1) setCurrentPlayerIndex(next);
    setView('correctGuess');
  };

  // Called when current player guesses wrong — just advance turn
  const handleWrongGuess = (logEntry) => {
    const player = gameSession.players[currentPlayerIndex];

    setQuestionLogs((prev) => ({
      ...prev,
      [player.id]: [logEntry, ...(prev[player.id] || [])],
    }));

    setTurnCounts((prev) => ({
      ...prev,
      [player.id]: (prev[player.id] || 0) + 1,
    }));

    const next = getNextPlayerIndex(currentPlayerIndex, lockedPositions);
    if (next !== -1) setCurrentPlayerIndex(next);
  };

  const finishRound = (locked) => {
    const updatedScores = { ...totalScores };
    locked.forEach((lp) => {
      updatedScores[lp.playerId] = (updatedScores[lp.playerId] || 0) + lp.points;
    });
    setTotalScores(updatedScores);
    setView('roundEnd');
  };

  const handlePeek = () => {
    const player = gameSession.players[currentPlayerIndex];
    setPeekedPlayers([...peekedPlayers, player.id]);
  };

  const handleNewRound = () => {
    setAssignmentIndex(0);
    setAssignments([]);
    setCurrentPlayerIndex(0);
    setLockedPositions([]);
    setPeekedPlayers([]);
    setQuestionLogs({});
    setTurnCounts(
      Object.fromEntries(gameSession.players.map((p) => [p.id, 0]))
    );
    setRoundNumber(roundNumber + 1);
    setView('assignment');
  };

  const handleEndSession = () => {
    clearSession();
    setView('leaderboard');
  };

  // Current state helpers
  const currentGuesser = gameSession?.players[currentPlayerIndex];
  const currentAssignment = assignments.find(
    (a) => a.playerId === currentGuesser?.id
  );
  const hasPeeked = peekedPlayers.includes(currentGuesser?.id);
  const lastLocked = lockedPositions[lockedPositions.length - 1];
  const assignmentPlayer = gameSession?.players[assignmentIndex];
  const assignmentCharacter = assignments.find(
    (a) => a.playerId === assignmentPlayer?.id
  );

  return (
    <div>
      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-lg w-full text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-3xl font-black text-white mb-3">Resume Game?</h2>
            <p className="text-white/60 text-lg mb-8">You have an unfinished game. Pick up where you left off?</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleResumeSession}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl">
                ✅ Resume Game
              </button>
              <button onClick={handleDiscardSession}
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-xl transition-colors">
                🗑️ Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'setup' && (
        <PlayerSetup onStartGame={handleStartGame} onGoToList={handleGoToList} players={setupPlayers} onPlayersChange={setSetupPlayers} />
      )}

      {view === 'listManager' && (
        <>
          <div className="flex items-center gap-4 m-6 mb-0">
            <button
              onClick={() => setView(listManagerOrigin)}
              className="text-white/60 hover:text-white transition-colors text-lg"
            >
              ← Back
            </button>
            {/* Player switcher — shown when multiple players are available */}
            {gameSession && gameSession.players.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {gameSession.players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setListManagerProfile(gameSession.players.find(pl => pl.id === p.id))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors
                      ${
                        listManagerProfile?.id === p.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                      }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ListManager
            key={listManagerProfile?.id}
            profile={listManagerProfile}
            onProfileUpdated={handleProfileUpdated}
          />
        </>
      )}

      {view === 'assignment' && gameSession && (
        <CharacterAssignment
          guesser={assignmentPlayer}
          onCharacterAssigned={handleCharacterAssigned}
          assignmentNumber={assignmentIndex + 1}
          totalPlayers={gameSession.players.length}
        />
      )}

      {view === 'reveal' && assignmentCharacter && (
        <CharacterReveal
          character={assignmentCharacter.character}
          guesserName={assignmentPlayer.name}
          onStartQuestioning={handleRevealDone}
          isLastPlayer={assignmentIndex === gameSession.players.length - 1}
        />
      )}

      {view === 'game' && currentAssignment && (
        <div className="flex justify-center">
          <div className="w-full max-w-2xl">
            <GameScreen
              guesser={currentGuesser}
              character={currentAssignment.character}
              players={gameSession.players}
              lockedPositions={lockedPositions}
              questionLog={questionLogs[currentGuesser.id] || []}
              turnCount={turnCounts[currentGuesser.id] || 0}
              hasPeeked={hasPeeked}
              onPeek={handlePeek}
              onTurnComplete={handleTurnComplete}
              onCorrectGuess={handleCorrectGuess}
              onWrongGuess={handleWrongGuess}
              timerEnabled={gameSession.settings.timerEnabled}
              timerSeconds={gameSession.settings.timerSeconds}
            />
          </div>
        </div>
      )}

      {view === 'correctGuess' && lastLocked && (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center w-full">
          <div className="w-full max-w-2xl mx-auto">
            <div className="text-9xl mb-6">🎉</div>
            <h2 className="text-5xl font-black text-white mb-3">{lastLocked.name} got it!</h2>
            <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500 mb-3">
              {lastLocked.position === 1 ? '🥇 1st' :
               lastLocked.position === 2 ? '🥈 2nd' :
               lastLocked.position === 3 ? '🥉 3rd' :
               `#${lastLocked.position}`}
            </p>
            <p className="text-2xl text-white/60 mb-3">in {lastLocked.turnsUsed} turns</p>
            {lockedPositions.filter(lp => lp.turnsUsed === lastLocked.turnsUsed && lp.playerId !== lastLocked.playerId).length > 0 && (
              <p className="text-yellow-400 font-bold text-xl mb-3">🤝 Tied!</p>
            )}
            <p className="text-3xl text-green-400 font-bold mb-10">+{lastLocked.points} points</p>
            <button
              onClick={() => {
                if (lockedPositions.length >= gameSession.players.length) {
                  finishRound(lockedPositions);
                } else {
                  setView('game');
                }
              }}
              className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-2xl rounded-xl transition-all"
            >
              Continue Game →
            </button>
          </div>
        </div>
      )}

      {view === 'roundEnd' && gameSession && (
        <RoundEnd
          players={gameSession.players}
          lockedPositions={lockedPositions}
          roundNumber={roundNumber}
          totalScores={totalScores}
          onNewRound={handleNewRound}
          onEndSession={handleEndSession}
        />
      )}

      {view === 'leaderboard' && gameSession && (
        <Leaderboard
          players={gameSession.players}
          totalScores={totalScores}
          roundNumber={roundNumber}
          onPlayAgain={() => { clearSession(); setGameSession(null); setSetupPlayers([]); setView('setup'); }}
          onEditLists={() => {
            setListManagerProfile(gameSession.players[0]);
            setView('listManager');
          }}
        />
      )}
    </div>
  );
}

export default App;
