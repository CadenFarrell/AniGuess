import { useState } from 'react';
import ListManager from '../../shared/components/ListManager';
import PlayerSetup from './components/PlayerSetup';
import CharacterAssignment from './components/CharacterAssignment';
import CharacterReveal from './components/CharacterReveal';
import GameScreen from './components/GameScreen';
import CorrectGuessScreen from './components/CorrectGuessScreen';
import RoundEnd from './components/RoundEnd';
import Leaderboard from './components/Leaderboard';
import { useGameSession } from './hooks/useGameSession';
import { useGameFlow } from './hooks/useGameFlow';
import { useEscapeKey } from '../../shared/hooks/useEscapeKey';

function App() {
  const [view, setView] = useState('setup');
  const [listManagerProfile, setListManagerProfile] = useState(null);
  const [listManagerOrigin, setListManagerOrigin] = useState('setup');
  const [setupPlayers, setSetupPlayers] = useState([]);
  const { clearSession } = useGameSession();

  const {
    gameSession, setGameSession,
    assignmentIndex,
    lockedPositions, questionLogs, turnCounts,
    roundNumber, totalScores,
    showResumePrompt, handleResumeSession, handleDiscardSession,
    handleStartGame, handleCharacterAssigned, handleRevealDone,
    handleTurnComplete, handleCorrectGuess, handleWrongGuess,
    finishRound, handlePeek, handleNewRound, handleEndSession,
    currentGuesser, currentAssignment, hasPeeked, lastLocked,
    assignmentPlayer, assignmentCharacter,
  } = useGameFlow({ view, setView });

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

  const handleGoToList = (profile) => {
    setListManagerProfile(profile);
    setListManagerOrigin(gameSession ? 'leaderboard' : 'setup');
    setView('listManager');
  };

  useEscapeKey(showResumePrompt, handleDiscardSession);

  return (
    <div>
      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true">
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
          allPlayers={gameSession.players}
          sharedShowsOnly={gameSession.settings.sharedShowsOnly}
          twoStepRandom={gameSession.settings.twoStepRandom}
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
              sharedShowsOnly={gameSession.settings.sharedShowsOnly ?? true}
            />
          </div>
        </div>
      )}

      {view === 'correctGuess' && lastLocked && (
        <CorrectGuessScreen
          lastLocked={lastLocked}
          lockedPositions={lockedPositions}
          onContinue={() => {
            if (lockedPositions.length >= gameSession.players.length) {
              finishRound(lockedPositions);
            } else {
              setView('game');
            }
          }}
        />
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
