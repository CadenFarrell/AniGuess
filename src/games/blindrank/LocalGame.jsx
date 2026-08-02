import { useState } from 'react';
import BlindRankSetup from './components/BlindRankSetup';
import BlindRankRound from './components/BlindRankRound';
import BlindRankResults from './components/BlindRankResults';
import { buildDeck } from './utils/deck';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anitune/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, deck }
  const [finished, setFinished] = useState(null); // { boards, scores }

  function start({ players, sharedOnly }) {
    setError(null);
    const { deck, candidates, enough } = buildDeck(players, { sharedOnly });
    if (!enough) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      setError(`Only ${candidates} shows with a known air date to draw from — need 10.`);
      return;
    }
    setGame({ players, deck, sharedOnly });
    setFinished(null);
    setView('round');
  }

  if (view === 'round' && game) {
    return (
      <BlindRankRound
        players={game.players}
        deck={game.deck}
        onFinish={(result) => { setFinished(result); setView('results'); }}
        onQuit={() => { setGame(null); setView('setup'); }}
      />
    );
  }

  if (view === 'results' && game && finished) {
    return (
      <BlindRankResults
        players={game.players}
        boards={finished.boards}
        deck={game.deck}
        totalScores={finished.scores}
        // Re-draw from the same lists rather than reusing the deck — a second
        // round of the same ten shows is no longer blind.
        onPlayAgain={() => start({ players: game.players, sharedOnly: game.sharedOnly })}
        onExit={onExit}
        playAgainLabel="🔁 New ten"
      />
    );
  }

  return <BlindRankSetup onStart={start} onExit={onExit} error={error} />;
}
