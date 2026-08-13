import { useState } from 'react';
import AniTuneSetup from './components/AniTuneSetup';
import AniTuneRound from './components/AniTuneRound';
import AniTuneResults from './components/AniTuneResults';
import { prepareQuestions } from './services/buildQuestions';
import { HubButton } from '../../shared/ui';

// Single-device pass-and-play. This is the original AniTuneGame body, unchanged —
// split out so AniTuneGame can offer the local/online choice the way AniGuessGame
// does. Online play lives in OnlineGame.jsx.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, round, questions, clipSeconds, settings }
  // { scores, lives, eliminated, playedCount } — the whole standings, not just
  // points, since Lives ranks on survival first and can end a round early.
  const [final, setFinal] = useState({ scores: {}, lives: {}, eliminated: [], playedCount: 0 });

  async function start(settings) {
    setPreparing(true);
    setError(null);
    setProgress({ phase: 'resolving', done: 0, total: settings.players.length });

    try {
      const { round, questions, unresolved, themeless } = await prepareQuestions(settings.players, {
        sharedSongsOnly: settings.sharedSongsOnly,
        includeOpenings: settings.includeOpenings,
        includeEndings: settings.includeEndings,
        popularity: settings.popularity,
        yearFrom: settings.yearFrom,
        yearTo: settings.yearTo,
        samplePoint: settings.samplePoint,
        maxPerAnime: settings.maxPerAnime,
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
      setFinal({
        scores: Object.fromEntries(settings.players.map((p) => [p.id, 0])),
        lives: {},
        eliminated: [],
        playedCount: 0,
      });
      setView('round');
    } catch (err) {
      setError(err.message || 'Something went wrong preparing the game.');
    } finally {
      setPreparing(false);
      setProgress(null);
    }
  }

  // Every local screen sits under one fixed "🏠 Hub" button rather than carrying
  // its own way out, so the exit never moves between views. Guarded mid-round
  // only: unlike AniGuess there is no saved session to resume back into, so
  // leaving really does discard the scores.
  const body = () => {
    if (view === 'round' && game) {
      return (
        <AniTuneRound
          players={game.players}
          round={game.round}
          questions={game.questions}
          clipSeconds={game.clipSeconds}
          playbackRate={game.playbackRate}
          mode={game.mode}
          // Only the settings a rule acts on; the rest decided what was dealt
          // or what renders, and startRound has no use for them.
          settings={{
            timed: game.timed,
            guessSeconds: game.guessSeconds,
            answerSeconds: game.answerSeconds,
            startingLives: game.startingLives,
          }}
          onFinish={(standings) => { setFinal(standings); setView('results'); }}
          onBackToSetup={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'results' && game) {
      return (
        <AniTuneResults
          players={game.players}
          scores={final.scores}
          lives={final.lives}
          eliminated={final.eliminated}
          mode={game.mode}
          round={game.round}
          playedCount={final.playedCount}
          roundSize={game.round.length}
          // Re-deal from the same question pool rather than re-fetching; the
          // caches make a full rebuild cheap, but this keeps it instant.
          onPlayAgain={() => start(game)}
          // "Play again" re-deals from the same question pool, so this is the
          // only route back to the options. Safe here and nowhere earlier: the
          // round is over and every answer already shown.
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return (
      <AniTuneSetup
        onStart={start}
        preparing={preparing}
        progress={progress}
        error={error}
        onBack={onBack}
      />
    );
  };

  return (
    <>
      <HubButton
        onClick={onExit}
        confirm={view === 'round' ? 'Return to the hub? The scores so far will be lost.' : null}
      />
      {body()}
    </>
  );
}
