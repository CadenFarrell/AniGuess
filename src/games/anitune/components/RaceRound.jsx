import GuessInput from './GuessInput';

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
        <p className="text-white text-center text-xl font-black mb-4">
          🔔 {player?.name} buzzed — name the anime
        </p>
        <GuessInput
          key={buzzedBy}
          questions={questions}
          onSubmit={onAnswer}
          submitLabel="Lock it in 🎯"
        />
        <p className="text-white/30 text-center text-xs mt-3">
          Miss it and you&apos;re out for this song — the clip picks back up for everyone else.
        </p>
      </div>
    );
  }

  const stillIn = players.filter((p) => !lockedOut.includes(p.id));

  return (
    <div className="mt-6">
      <p className="text-white/60 text-center mb-4">
        {stillIn.length === players.length
          ? 'First one to name it takes the point'
          : `${stillIn.length} still in`}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => {
          const out = lockedOut.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onBuzz(p.id)}
              disabled={out}
              className={`py-6 rounded-xl font-black text-lg transition-colors ${
                out
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white'
              }`}
            >
              {out ? `🚫 ${p.name}` : `🔔 ${p.name}`}
            </button>
          );
        })}
      </div>

      {/* Held back until the clip has finished (or failed outright) so it can't
          be tapped out of impatience three seconds in — but it must appear
          eventually, or a dead clip has no way past it. */}
      {clipDone && (
        <button
          onClick={onGiveUp}
          className="w-full mt-4 py-3 text-white/40 hover:text-white transition-colors text-sm"
        >
          Nobody got it — reveal the answer
        </button>
      )}
    </div>
  );
}
