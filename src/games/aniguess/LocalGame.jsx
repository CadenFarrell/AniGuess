import { useState } from 'react';
import { useProfileStore } from '../../shared/context/profileContext';
import ListManager from '../../shared/components/ListManager';
import PlayerSetup from './components/PlayerSetup';
import CharacterAssignment from './components/CharacterAssignment';
import CharacterReveal from './components/CharacterReveal';
import GameScreen from './components/GameScreen';
import CorrectGuessScreen from './components/CorrectGuessScreen';
import RoundEnd from './components/RoundEnd';
import Leaderboard from './components/Leaderboard';
import { useGameSession } from './hooks/useGameSession';
import { useGameFlow, RESUMABLE_VIEWS } from './hooks/useGameFlow';
import { Button, GhostButton, HubButton, Modal } from '../../shared/ui';

function App({ onExit }) {
  const [view, setView] = useState('setup');
  const [listManagerProfile, setListManagerProfile] = useState(null);
  const [listManagerOrigin, setListManagerOrigin] = useState('setup');
  // The hub's profile joins the game already seated — this is pass-and-play, so
  // the name box below stays for everyone else on the couch. Reading it in the
  // initializer is safe: ProfileProvider resolves the active profile from
  // localStorage synchronously, so it is present on the very first render.
  const { activeProfile } = useProfileStore();
  const [setupPlayers, setSetupPlayers] = useState(() => activeProfile ? [activeProfile] : []);
  const { clearSession } = useGameSession();

  const {
    gameSession, setGameSession,
    assignmentIndex, assignments,
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

  // Only guard the exit mid-game. Those are exactly the views useGameFlow
  // auto-saves, so the game really is waiting on the next visit.
  const exitConfirm = RESUMABLE_VIEWS.includes(view)
    ? 'Return to the hub? Your game is saved — you can resume it next time.'
    : null;

  return (
    <div>
      <HubButton onClick={onExit} confirm={exitConfirm} />

      {/* Resume Prompt. Escape discards, as it always has — but not a stray
          backdrop click, which would throw away an unfinished game. */}
      {showResumePrompt && (
        <Modal onClose={handleDiscardSession} closeOnBackdrop={false} className="text-center">
          <div className="mb-4 text-6xl">🎮</div>
          <h2 className="mb-3 font-display text-3xl font-extrabold text-white">Resume Game?</h2>
          <p className="mb-8 text-lg text-white/60">
            You have an unfinished game. Pick up where you left off?
          </p>
          <div className="flex flex-col gap-3">
            <Button variant="success" size="lg" fullWidth onClick={handleResumeSession}>
              ✅ Resume Game
            </Button>
            <Button variant="neutral" size="lg" fullWidth onClick={handleDiscardSession}>
              🗑️ Start Fresh
            </Button>
          </div>
        </Modal>
      )}

      {view === 'setup' && (
        <PlayerSetup onStartGame={handleStartGame} onGoToList={handleGoToList} players={setupPlayers} onPlayersChange={setSetupPlayers} />
      )}

      {view === 'listManager' && (
        <>
          {/* mt-16 clears the fixed HubButton at top-left; this row is the
              in-flow "← Back" + player switcher and would otherwise sit under it. */}
          <div className="flex flex-wrap items-center gap-3 mx-5 mb-0 mt-16 sm:mx-6">
            <GhostButton onClick={() => setView(listManagerOrigin)}>← Back</GhostButton>
            {/* Player switcher — shown when multiple players are available */}
            {gameSession && gameSession.players.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {gameSession.players.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={listManagerProfile?.id === p.id ? 'secondary' : 'neutral'}
                    onClick={() => setListManagerProfile(gameSession.players.find(pl => pl.id === p.id))}
                  >
                    {p.name}
                  </Button>
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

      {/* GameScreen brings its own <Screen> shell now, so no outer wrapper. */}
      {view === 'game' && currentAssignment && (
        <GameScreen
          guesser={currentGuesser}
          character={currentAssignment.character}
          players={gameSession.players}
          assignments={assignments}
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
          onPlayAgain={() => {
            clearSession();
            setGameSession(null);
            // Back to the same starting state as a fresh visit, not to an empty
            // roster — otherwise "Play Again" quietly un-seats you.
            setSetupPlayers(activeProfile ? [activeProfile] : []);
            setView('setup');
          }}
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
