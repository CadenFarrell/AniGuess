import { useCallback, useState } from 'react';
import AniFakeSetup from './components/AniFakeSetup';
import LocalRound from './components/LocalRound';
import AniFakeResults from './components/AniFakeResults';
import { eligibleCharacters } from './utils/pool';
import { applyRoundScores, minPool, seating } from './rules';
import { HubButton } from '../../shared/ui';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anirank/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | round | results
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, pool, settings }
  const [finished, setFinished] = useState(null);
  const [totalScores, setTotalScores] = useState({});
  // Bumped per round so LocalRound remounts and re-deals rather than reusing a
  // hook whose lazy initializer has already run.
  const [roundKey, setRoundKey] = useState(0);

  const start = ({ players, sharedOnly, mode, laps, talkMode, fame, allowRedeal }) => {
    setError(null);
    const pool = eligibleCharacters(players, { sharedOnly });
    const needed = minPool(mode);
    if (pool.length < needed) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      setError(`Only ${pool.length} characters to draw from — ${mode} mode needs ${needed}.`);
      return;
    }
    // talkMode rides in settings rather than on the round: it decides which
    // screen renders, never what the rules accept, so it must not reach
    // rules.startRound. `fame` is the same kind of thing one layer down — it
    // shapes the draw, not the round — and `allowRedeal` decides whether the
    // check phase exists at all. onPlayAgain spreads settings straight back in
    // here, so a re-deal keeps all of them without any extra plumbing; anything
    // left out of this object is silently dropped on the second round.
    setGame({
      players,
      pool,
      sharedOnly,
      settings: { mode, laps, wordLimit: 1, talkMode, fame, allowRedeal },
    });
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

  // Every local screen sits under one fixed "🏠 Hub" button rather than carrying
  // its own way out, so the exit never moves between views. Rendering it here
  // rather than per screen is what gives the pass-and-play screens inside
  // LocalRound — SecretReveal, CardCheck, VoteScreen, StealScreen and the two
  // interstitials — a way out at all; they had none, and only ClueRound's
  // "← Leave the round" (which drops back to setup, not home) ever did.
  const body = () => {
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
          // Seated, so the reveal lists players in the same order and under the
          // same seat numbers the clue log and the ballot used.
          players={seating(finished.state, game.players)}
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
          // "New round" re-deals with the same mode and settings, so this is the
          // only route back to the options. Safe here and nowhere earlier: the
          // reveal has happened, so there is no secret left to protect. Note
          // start() does not clear totalScores, so this changes the settings
          // mid-session rather than starting a fresh one — same as Play again.
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    return <AniFakeSetup onStart={start} error={error} onBack={onBack} />;
  };

  return (
    <>
      <HubButton
        onClick={onExit}
        confirm={view === 'round' ? 'Return to the hub? The round will be lost.' : null}
      />
      {body()}
    </>
  );
}
