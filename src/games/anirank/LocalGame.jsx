import { useCallback, useState } from 'react';
import AniRankSetup from './components/AniRankSetup';
import AniRankRound from './components/AniRankRound';
import AniRankResults from './components/AniRankResults';
import TierMode from './TierMode';
import { buildDeck } from './utils/deck';
import { getAxis, isOpinion } from './axes';
import { applyRoundScores, subjectFor } from './rules';
import { HubButton } from '../../shared/ui';

// Single-device pass-and-play. A thin view-router, the same shape as
// src/games/anitune/LocalGame.jsx: it holds a `view` string and hands the work
// to dumb screens from components/.
export default function LocalGame({ onExit, onBack }) {
  const [view, setView] = useState('setup'); // setup | round | results | tiers
  const [error, setError] = useState(null);
  const [game, setGame] = useState(null); // { players, deck, axis, subjectId, ... }
  const [finished, setFinished] = useState(null); // { boards, scores }
  // Counts rounds rather than tracking a subject directly, so "play again" walks
  // the roster instead of asking the same person to be the subject every time.
  const [roundIndex, setRoundIndex] = useState(0);
  // The running total across every round of this sitting, exactly as the online
  // hook keeps it. Local play used to hand the results screen ONE round's
  // scores as `totalScores` and then throw them away on "New ten", so
  // rules.applyRoundScores was dead code in this path and a local session had no
  // memory — the same game scored differently depending on how you were playing
  // it. AniFake's LocalGame is the shape being matched here.
  const [totalScores, setTotalScores] = useState({});

  // `axis` is a spec — a built-in's id, or the whole definition of a prompt the
  // player wrote, which no lookup could recover. getAxis resolves either.
  function start({ players, sharedOnly, axis, scoring, blind, format = 'round' }, nextRound = 0) {
    setError(null);
    // Round zero is the only way into a fresh sitting — the setup screen calls
    // start() with the default, "New ten" always passes roundIndex + 1 — so
    // clearing here covers every path back to setup without a second reset to
    // keep in step with this one.
    if (nextRound === 0) setTotalScores({});
    const resolved = getAxis(axis);

    // The tier-list formats have no deck, no subject and no score — they take
    // the whole pool rather than ten cards of it, so none of the round setup
    // below applies. See TierMode.jsx.
    if (format !== 'round') {
      setGame({ players, sharedOnly, axis, format });
      setFinished(null);
      setView('tiers');
      return;
    }

    const { deck, candidates, enough } = buildDeck(players, { axis: resolved, sharedOnly });
    if (!enough) {
      // The setup screen already gates on this, so reaching here means the
      // roster changed under it — say the number rather than failing silently.
      const noun = resolved.items === 'characters' ? 'characters' : 'shows';
      setError(`Only ${candidates} ${noun} to draw from for this mode — need 10.`);
      return;
    }
    const subjectId = isOpinion(resolved)
      ? subjectFor(players.map((p) => p.id), nextRound)
      : null;
    // `blind` rides along in `game` so onPlayAgain, which re-passes the whole
    // object back into start(), deals the next ten the same way.
    setGame({ players, deck, sharedOnly, axis, scoring, blind, subjectId });
    setRoundIndex(nextRound);
    setFinished(null);
    setView('round');
  }

  // Stable, so AniRankRound's finish effect isn't re-armed every render — and
  // the functional update is what makes a double-fire harmless if it ever is.
  const handleFinish = useCallback((result) => {
    setFinished(result);
    setTotalScores((totals) => applyRoundScores(totals, result.scores));
    setView('results');
  }, []);

  // Every local screen sits under one fixed "🏠 Hub" button rather than carrying
  // its own way out, so the exit never moves between views. This is also what
  // separates the two exits the round has: the Hub button leaves the game, while
  // AniRankRound's own "← Quit round" drops back to setup — they used to be the
  // same `onQuit`, so the round's 🏠 Hub button went to setup and never home.
  const body = () => {
    if (view === 'tiers' && game) {
      return (
        <TierMode
          players={game.players}
          sharedOnly={game.sharedOnly}
          axis={game.axis}
          format={game.format}
          onBack={() => { setGame(null); setView('setup'); }}
        />
      );
    }

    if (view === 'round' && game) {
      return (
        <AniRankRound
          players={game.players}
          deck={game.deck}
          axis={game.axis}
          subjectId={game.subjectId}
          scoring={game.scoring}
          blind={game.blind}
          onFinish={handleFinish}
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
          axis={game.axis}
          subjectId={game.subjectId}
          scoring={game.scoring}
          totalScores={totalScores}
          // What the round just played was worth, against the running total
          // above it. Online has always shown this; without it a second round
          // just changes every number with no way to see what earned it.
          roundScores={finished.scores}
          // Re-draw from the same lists rather than reusing the deck — a second
          // round of the same ten cards is no longer blind — and pass the turn to
          // the next subject.
          onPlayAgain={() => start(game, roundIndex + 1)}
          // "New ten" re-deals with the same axis and settings, so this is the
          // only route back to the options. Safe here and nowhere earlier: the
          // round is over and the deck already shown, so there is nothing left
          // to un-reveal.
          onBack={() => { setGame(null); setView('setup'); }}
          playAgainLabel="🔁 New ten"
        />
      );
    }

    return <AniRankSetup onStart={start} error={error} onBack={onBack} />;
  };

  return (
    <>
      <HubButton
        onClick={onExit}
        confirm={view === 'round' ? 'Return to the hub? The board will be lost.' : null}
      />
      {body()}
    </>
  );
}
