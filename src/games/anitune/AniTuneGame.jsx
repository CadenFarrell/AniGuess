import { useState } from 'react';
import AniTuneSetup from './components/AniTuneSetup';
import AniTuneRound from './components/AniTuneRound';
import AniTuneResults from './components/AniTuneResults';
import { prepareQuestions } from './services/buildQuestions';

export default function AniTuneGame({ onExit }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, round, questions, clipSeconds, settings }
  const [scores, setScores] = useState({});

  async function start(settings) {
    setPreparing(true);
    setError(null);
    setProgress({ phase: 'resolving', done: 0, total: settings.players.length });

    try {
      const { round, questions, unresolved, themeless } = await prepareQuestions(settings.players, {
        sharedSongsOnly: settings.sharedSongsOnly,
        includeOpenings: settings.includeOpenings,
        includeEndings: settings.includeEndings,
        roundSize: settings.roundSize,
        onProgress: setProgress,
      });

      if (!round.length) {
        const skipped = unresolved.length + themeless.length;
        setError(
          skipped
            ? `No playable songs found. ${skipped} show${skipped === 1 ? '' : 's'} had no themes on AnimeThemes.`
            : 'No playable songs found for these settings.'
        );
        return;
      }

      setGame({ ...settings, round, questions });
      setScores(Object.fromEntries(settings.players.map((p) => [p.id, 0])));
      setView('round');
    } catch (err) {
      setError(err.message || 'Something went wrong preparing the game.');
    } finally {
      setPreparing(false);
      setProgress(null);
    }
  }

  if (view === 'round' && game) {
    return (
      <AniTuneRound
        players={game.players}
        round={game.round}
        questions={game.questions}
        clipSeconds={game.clipSeconds}
        onFinish={(finalScores) => { setScores(finalScores); setView('results'); }}
        onExit={() => { setGame(null); setView('setup'); }}
      />
    );
  }

  if (view === 'results' && game) {
    return (
      <AniTuneResults
        players={game.players}
        scores={scores}
        roundSize={game.round.length}
        // Re-deal from the same question pool rather than re-fetching; the
        // caches make a full rebuild cheap, but this keeps it instant.
        onPlayAgain={() => start(game)}
        onExit={onExit}
      />
    );
  }

  return (
    <AniTuneSetup
      onStart={start}
      onExit={onExit}
      preparing={preparing}
      progress={progress}
      error={error}
    />
  );
}
