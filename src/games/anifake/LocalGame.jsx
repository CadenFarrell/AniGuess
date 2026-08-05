import { useCallback, useState } from 'react';
import AniFakeSetup from './components/AniFakeSetup';
import LocalRound from './components/LocalRound';
import AniFakeResults from './components/AniFakeResults';
import { eligibleCharacters } from './utils/pool';
import { applyRoundScores, minPool } from './rules';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anirank/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, pool, settings }
  const [finished, setFinished] = useState(null);
  const [totalScores, setTotalScores] = useState({});
  // Bumped per round so LocalRound remounts and re-deals rather than reusing a
  // hook whose lazy initializer has already run.
  const [roundKey, setRoundKey] = useState(0);

  const start = ({ players, sharedOnly, mode, laps }) => {
    setError(null);
    const pool = eligibleCharacters(players, { sharedOnly });
    const needed = minPool(mode);
    if (pool.length < needed) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      setError(`Only ${pool.length} characters to draw from — ${mode} mode needs ${needed}.`);
      return;
    }
    setGame({ players, pool, sharedOnly, settings: { mode, laps, wordLimit: 1 } });
    setFinished(null);
    setRoundKey((k) => k + 1);
    setView('round');
  };

  // Stable, so LocalRound's finish effect isn't re-armed every render.
  const handleFinish = useCallback((result) => {
    setFinished(result);
    setTotalScores((totals) => applyRoundScores(totals, result.scores));
    setView('results');
  }, []);

  if (view === 'round' && game) {
    return (
      <LocalRound
        key={roundKey}
        players={game.players}
        pool={game.pool}
        settings={game.settings}
        onFinish={handleFinish}
        onQuit={() => { setGame(null); setView('setup'); }}
      />
    );
  }

  if (view === 'results' && game && finished) {
    return (
      <AniFakeResults
        players={game.players}
        game={finished.state}
        fakeId={finished.fakeId}
        secret={finished.secret}
        fakeCard={finished.fakeCard}
        roundScores={finished.scores}
        totalScores={totalScores}
        // Re-deals from the same pool rather than reusing the round: roundKey
        // remounts LocalRound, whose lazy initializer picks a fresh secret.
        onPlayAgain={() => start({
          players: game.players,
          sharedOnly: game.sharedOnly,
          ...game.settings,
        })}
        onExit={onExit}
      />
    );
  }

  return <AniFakeSetup onStart={start} onExit={onExit} error={error} />;
}
