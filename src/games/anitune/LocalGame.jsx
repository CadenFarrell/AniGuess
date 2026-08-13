import { useCallback, useState } from 'react';
import AniTuneSetup from './components/AniTuneSetup';
import AniTuneRound from './components/AniTuneRound';
import AniTuneResults from './components/AniTuneResults';
import { prepareQuestions } from './services/buildQuestions';
import { resumeRound } from './rules';
import { storage } from '../../shared/services/storage';
import { useProfileStore } from '../../shared/context/profileContext';
import { Button, HubButton, Modal } from '../../shared/ui';

// Per-game, matching the `<game>_*` convention, so it cannot collide with
// aniguess_session.
const SESSION_KEY = 'anitune_session';

/**
 * What gets saved, and what deliberately does not.
 *
 * `round` and `questions` are kept because they came off the network — the
 * dealt clips and the pool the typeahead suggests from — and re-fetching them
 * would mean sitting through "finding songs" again to get back to a game that
 * was already dealt. They are ids, titles and URLs, a few hundred KB at worst.
 *
 * PLAYERS ARE SAVED AS IDS, not objects, and that is the whole reason this blob
 * is a sensible size. A seated player is a whole profile — every show, every
 * character, every cover URL — and aniguess_profiles already runs to several
 * hundred KB on this origin for exactly that reason. Storing them twice would
 * risk the quota to duplicate data that is already one lookup away, so resume
 * rehydrates from the profile store instead.
 */
const packSession = (game, state) => ({
  playerIds: game.players.map((p) => p.id),
  settings: {
    mode: game.mode, clipSeconds: game.clipSeconds, playbackRate: game.playbackRate,
    timed: game.timed, guessSeconds: game.guessSeconds,
    answerSeconds: game.answerSeconds, startingLives: game.startingLives,
  },
  round: game.round,
  questions: game.questions,
  state,
});

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
  // A round restored from storage, handed to AniTuneRound as its opening state.
  // Null for a fresh deal, which is every other path into the round view.
  const [resumed, setResumed] = useState(null);

  const { profiles } = useProfileStore();
  // Read once, at mount. A session saved by THIS sitting must not re-offer
  // itself mid-game, and the round view writes to the same key continuously.
  const [saved, setSaved] = useState(() => storage.getItem(SESSION_KEY));
  const [dismissed, setDismissed] = useState(false);
  const showResume = Boolean(saved) && !dismissed && view === 'setup';

  const discardSession = useCallback(() => {
    storage.removeItem(SESSION_KEY);
    setSaved(null);
    setDismissed(true);
  }, []);

  // Save after every state change. storage.setItem swallows a quota failure,
  // and unlike a tier list that is not worth a banner here: the failure mode is
  // "resume isn't offered", which is exactly how this screen behaved before it
  // existed, and the round in front of you is unaffected either way.
  const handleProgress = useCallback((roundState) => {
    if (!game) return;
    storage.setItem(SESSION_KEY, packSession(game, roundState));
  }, [game]);

  const handleResume = () => {
    setDismissed(true);
    // Players come back from the profile store by id, so a profile deleted or
    // renamed since the round was saved takes the session with it rather than
    // resuming a game somebody is no longer in.
    const players = (saved?.playerIds ?? []).map((id) => profiles[id]).filter(Boolean);
    const round = saved?.round ?? [];
    const state = players.length === (saved?.playerIds?.length ?? -1)
      ? resumeRound(saved.state, players, round.length)
      : null;
    if (!state) { discardSession(); return; }

    setGame({ ...saved.settings, players, round, questions: saved.questions ?? [] });
    setResumed(state);
    setFinal({
      scores: state.scores,
      lives: state.lives,
      eliminated: state.eliminated,
      // The question being resumed into has not been played yet, so the count
      // is the index rather than index + 1.
      playedCount: state.index,
    });
    setSaved(null);
    setView('round');
  };

  async function start(settings) {
    // A fresh deal supersedes whatever was saved — including the one being
    // replayed from, since "play again" comes back through here.
    setResumed(null);
    storage.removeItem(SESSION_KEY);
    setSaved(null);
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
  // its own way out, so the exit never moves between views.
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
          initialState={resumed}
          onProgress={handleProgress}
          onFinish={(standings) => {
            // The round is over, so there is nothing to come back to. Clearing
            // here rather than on the results screen's buttons means every way
            // out of a finished round clears it, including the Hub.
            storage.removeItem(SESSION_KEY);
            setResumed(null);
            setFinal(standings);
            setView('results');
          }}
          onBackToSetup={() => {
            storage.removeItem(SESSION_KEY);
            setResumed(null);
            setGame(null);
            setView('setup');
          }}
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
        // No longer a warning, because it is no longer true: the round view
        // saves after every state change, so leaving mid-round parks the game
        // rather than discarding it.
        confirm={
          view === 'round'
            ? 'Return to the hub? Your game is saved — you can resume it next time.'
            : null
        }
      />

      {/* Escape discards, matching AniGuess's — but not a stray backdrop click,
          which would throw away an unfinished round. */}
      {showResume && (
        <Modal onClose={discardSession} closeOnBackdrop={false} className="text-center">
          <div className="mb-4 text-6xl">🎵</div>
          <h2 className="mb-3 font-display text-3xl font-extrabold text-white">Resume round?</h2>
          <p className="mb-8 text-lg text-white/60">
            You left a round unfinished
            {saved?.round?.length
              ? ` on song ${Math.min((saved.state?.index ?? 0) + 1, saved.round.length)} of ${saved.round.length}`
              : ''}
            . Scores carry over, and that song starts again from the top.
          </p>
          <div className="flex flex-col gap-3">
            <Button variant="success" size="lg" fullWidth onClick={handleResume}>
              ✅ Resume round
            </Button>
            <Button variant="neutral" size="lg" fullWidth onClick={discardSession}>
              🗑️ Start fresh
            </Button>
          </div>
        </Modal>
      )}

      {body()}
    </>
  );
}
