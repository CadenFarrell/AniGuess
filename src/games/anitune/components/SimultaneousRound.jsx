import GuessInput from './GuessInput';

// Simultaneous mode: one clip, then the device goes round the table and each
// player types their own answer. Verdicts are withheld until everyone is in, so
// the person entering fourth learns nothing from the first three.
export default function SimultaneousRound({
  players, questions, phase, entryOrder, entryIndex, answers,
  onStartGuessing, onReady, onSubmit,
}) {
  const currentId = entryOrder[entryIndex];
  const current = players.find((p) => p.id === currentId);

  // Order the strip by the pass order so it doubles as "who's up next".
  const strip = (
    <div className="flex gap-2 flex-wrap justify-center mt-6">
      {entryOrder.map((id) => {
        const player = players.find((p) => p.id === id);
        const locked = Boolean(answers[id]);
        return (
          <span key={id}
            className={`px-3 py-1 rounded-lg text-sm font-bold ${
              locked ? 'bg-green-600/20 text-green-400'
                : id === currentId ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-white/30'
            }`}>
            {locked ? '🔒' : id === currentId ? '✍️' : '⏳'} {player?.name}
          </span>
        );
      })}
    </div>
  );

  if (phase === 'listening') {
    return (
      <div className="mt-6">
        <p className="text-white/60 text-center mb-4">
          Everyone listen — you&apos;ll each get to answer.
        </p>
        <button
          onClick={onStartGuessing}
          className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-colors"
        >
          Start guessing →
        </button>
      </div>
    );
  }

  if (phase === 'handoff') {
    return (
      <div className="mt-6">
        <div className="bg-white/5 rounded-xl p-8 text-center">
          <div className="text-5xl mb-3">📲</div>
          <p className="text-white/60 mb-1">Pass the device to</p>
          <p className="text-white text-3xl font-black mb-6">{current?.name}</p>
          <button
            onClick={onReady}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-colors"
          >
            I&apos;m {current?.name} — ready
          </button>
        </div>
        {strip}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-white text-center text-xl font-black mb-1">
        {current?.name}, which anime?
      </p>
      <p className="text-white/30 text-center text-xs mb-4">
        Hidden as you type — everyone else, no peeking at the keyboard.
      </p>
      <GuessInput
        key={currentId}
        questions={questions}
        masked
        placeholder="Type your answer…"
        submitLabel="Lock in 🔒"
        skipLabel="Pass"
        onSubmit={(text) => onSubmit(text)}
        onSkip={() => onSubmit('')}
      />
      {strip}
    </div>
  );
}
