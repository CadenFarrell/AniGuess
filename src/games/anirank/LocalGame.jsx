import { useState } from 'react';
import AniRankSetup from './components/AniRankSetup';
import AniRankRound from './components/AniRankRound';
import AniRankResults from './components/AniRankResults';
import { buildDeck } from './utils/deck';
import { getAxis, isOpinion } from './axes';
import { subjectFor } from './rules';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anitune/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, deck, axisId, subjectId, ... }
  const [finished, setFinished] = useState(null); // { boards, scores }
  // Counts rounds rather than tracking a subject directly, so "play again" walks
  // the roster instead of asking the same person to be the subject every time.
  const [roundIndex, setRoundIndex] = useState(0);

  function start({ players, sharedOnly, axisId, scoring }, nextRound = 0) {
    setError(null);
    const axis = getAxis(axisId);
    const { deck, candidates, enough } = buildDeck(players, { axis, sharedOnly });
    if (!enough) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      const noun = axis.items === 'characters' ? 'characters' : 'shows';
      setError(`Only ${candidates} ${noun} to draw from for this mode — need 10.`);
      return;
    }
    const subjectId = isOpinion(axis)
      ? subjectFor(players.map((p) => p.id), nextRound)
      : null;
    setGame({ players, deck, sharedOnly, axisId, scoring, subjectId });
    setRoundIndex(nextRound);
    setFinished(null);
    setView('round');
  }

  if (view === 'round' && game) {
    return (
      <AniRankRound
        players={game.players}
        deck={game.deck}
        axisId={game.axisId}
        subjectId={game.subjectId}
        scoring={game.scoring}
        onFinish={(result) => { setFinished(result); setView('results'); }}
        onQuit={() => { setGame(null); setView('setup'); }}
      />
    );
  }

  if (view === 'results' && game && finished) {
    return (
      <AniRankResults
        players={game.players}
        boards={finished.boards}
        deck={game.deck}
        axisId={game.axisId}
        subjectId={game.subjectId}
        scoring={game.scoring}
        totalScores={finished.scores}
        // Re-draw from the same lists rather than reusing the deck — a second
        // round of the same ten cards is no longer blind — and pass the turn to
        // the next subject.
        onPlayAgain={() => start(game, roundIndex + 1)}
        onExit={onExit}
        playAgainLabel="🔁 New ten"
      />
    );
  }

  return <AniRankSetup onStart={start} onExit={onExit} error={error} />;
}
