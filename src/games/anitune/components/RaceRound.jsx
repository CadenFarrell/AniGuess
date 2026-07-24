import GuessInput from './GuessInput';
import { Button, GhostButton } from '../../../shared/ui';

// Race mode: the clip plays for the room and everyone is in until they miss.
// Buzzing is committing — the button is your claim on the answer — so a wrong
// guess takes you out of this question and hands the clip back to the rest.
export default function RaceRound({
  players, questions, lockedOut, buzzedBy, clipDone,
  onBuzz, onAnswer, onGiveUp,
}) {
  if (buzzedBy) {
    const player = players.find((p) => p.id === buzzedBy);
    return (
      <div className="mt-6">
        <p className="mb-4 text-center font-display text-xl font-extrabold text-white">
          🔔 {player?.name} buzzed — name the anime
        </p>
        <GuessInput
          key={buzzedBy}
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

  const stillIn = players.filter((p) => !lockedOut.includes(p.id));

  return (
    <div className="mt-6">
      <p className="mb-4 text-center text-base text-white/60">
        {stillIn.length === players.length
          ? 'First one to name it takes the point'
          : `${stillIn.length} still in`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((p) => {
          const out = lockedOut.includes(p.id);
          return (
            <Button
              key={p.id}
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => onBuzz(p.id)}
              disabled={out}
            >
              {out ? `🚫 ${p.name}` : `🔔 ${p.name}`}
            </Button>
          );
        })}
      </div>

      {/* Held back until the clip has finished (or failed outright) so it can't
          be tapped out of impatience three seconds in — but it must appear
          eventually, or a dead clip has no way past it. */}
      {clipDone && (
        <div className="mt-4 text-center">
          <GhostButton onClick={onGiveUp}>Nobody got it — reveal the answer</GhostButton>
        </div>
      )}
    </div>
  );
}
