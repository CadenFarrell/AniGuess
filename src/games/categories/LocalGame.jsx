import { useState } from 'react';
import AniTagSetup from './components/AniTagSetup';
import LocalSession from './components/LocalSession';
import AniTagResults from './components/AniTagResults';
import { HubButton } from '../../shared/ui';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/wavelength/LocalGame.jsx: it holds a `view` string and hands the
// work to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | playing | results
  // { players, rounds, proposalCap, categoryPool, categoryMode, customCategories }
  const [game, setGame] = useState(null);
  const [totals, setTotals] = useState({});
  // Bumped per session so LocalSession remounts and re-deals rather than reusing
  // a hook whose lazy initializers have already run.
  const [sessionKey, setSessionKey] = useState(0);

  const start = (settings) => {
    setGame(settings);
    setTotals({});
    setSessionKey((k) => k + 1);
    setView('playing');
  };

  const body = () => {
    if (view === 'playing' && game) {
      return (
        <LocalSession
          key={sessionKey}
          players={game.players}
          rounds={game.rounds}
          proposalCap={game.proposalCap}
          categoryPool={game.categoryPool}
          categoryMode={game.categoryMode}
          customCategories={game.customCategories}
          onFinish={(totalScores) => { setTotals(totalScores); setView('results'); }}
          onQuit={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'results' && game) {
      return (
        <AniTagResults
          players={game.players}
          totalScores={totals}
          onPlayAgain={() => start(game)}
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return <AniTagSetup onStart={start} onBack={onBack} />;
  };

  // Every local screen sits under one fixed "🏠 Hub" button rather than carrying
  // its own way out, so the exit never moves between views.
  return (
    <>
      <HubButton
        onClick={onExit}
        confirm={view === 'playing' ? 'Return to the hub? The session will be lost.' : null}
      />
      {body()}
    </>
  );
}
