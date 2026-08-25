import { useState } from 'react';
import WavelengthSetup from './components/WavelengthSetup';
import LocalSession from './components/LocalSession';
import WavelengthResults from './components/WavelengthResults';
import { HubButton } from '../../shared/ui';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anifake/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | playing | results
  // { players, rounds, mode, cardPool, sharedOnly }
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
          mode={game.mode}
          cardPool={game.cardPool}
          sharedOnly={game.sharedOnly}
          onFinish={(totalScores) => { setTotals(totalScores); setView('results'); }}
          onQuit={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'results' && game) {
      return (
        <WavelengthResults
          players={game.players}
          totalScores={totals}
          onPlayAgain={() => start(game)}
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return <WavelengthSetup onStart={start} onBack={onBack} />;
  };

  // Every local screen sits under one fixed "🏠 Hub" button rather than carrying
  // its own way out, so the exit never moves between views — and the pass
  // screens inside LocalSession get a way out at all.
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
