import GuessInput from './GuessInput';
import { Button, GhostButton } from '../../../shared/ui';

// Race mode, one player per device. The buzz is the whole game — first device to
// claim it (a transaction in the room hook) gets the guess box; everyone else is
// told to wait. A miss locks this player out for the song and the clip picks back
// up for the rest.
export default function OnlineRaceRound({
  players, questions, question, game, myPlayerId,
  isMyBuzz, clipStarted, clipDone,
  onBuzz, onAnswer, onGiveUp,
}) {
  const lockedOut = game.lockedOut || [];
  const amLockedOut = lockedOut.includes(myPlayerId);

  if (game.buzzedBy) {
    if (isMyBuzz) {
      return (
        <div className="mt-6">
          <p className="mb-4 text-center font-display text-xl font-extrabold text-white">
            🔔 You buzzed — name the anime
          </p>
          <GuessInput
            key={question.id}
            questions={questions}
            onSubmit={onAnswer}
            submitLabel="Lock it in 🎯"
          />
          <p className="mt-3 text-center text-sm text-white/30">
            Miss it and you&apos;re out for this song — the clip picks back up for everyone else.
          </p>
        </div>
      );
    }
    const buzzer = players.find((p) => p.id === game.buzzedBy);
    return (
      <div className="mt-6 text-center">
        <div className="mb-3 text-5xl">🔔</div>
        <p className="font-display text-xl font-extrabold text-white">
          {buzzer?.name || 'Someone'} buzzed
        </p>
        <p className="mt-1 text-white/50">Hang tight — see if they get it…</p>
      </div>
    );
  }

  const stillIn = players.filter((p) => !lockedOut.includes(p.id));

  return (
    <div className="mt-6">
      <p className="mb-4 text-center text-base text-white/60">
        {stillIn.length === players.length
          ? 'First one to name it takes the point'
          : `${stillIn.length} still in`}
      </p>

      <Button
        variant="primary"
        size="xl"
        fullWidth
        onClick={onBuzz}
        disabled={amLockedOut || !clipStarted}
      >
        {amLockedOut ? "🚫 You're out for this song" : '🔔 BUZZ'}
      </Button>

      {!clipStarted && !amLockedOut && (
        <p className="mt-3 text-center text-sm text-white/30">Wait for the clip to start…</p>
      )}

      {/* Held back until the clip has finished (or failed) so it can't be tapped
          out of impatience — but it must appear eventually, or a dead clip has no
          way past it. */}
      {clipDone && (
        <div className="mt-4 text-center">
          <GhostButton onClick={onGiveUp}>Nobody got it — reveal the answer</GhostButton>
        </div>
      )}
    </div>
  );
}
