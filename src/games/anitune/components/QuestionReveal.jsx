import { RACE } from '../rules';

// The answer card plus who scored on it. Shared by both modes — only the
// per-player breakdown differs, since a race has at most one winner while a
// simultaneous question can have any number.
export default function QuestionReveal({
  question, mode, players, answers, onNext, nextLabel,
}) {
  const scorers = players.filter((p) => answers[p.id]?.correct);
  const isRace = mode === RACE;
  const winner = isRace ? scorers[0] : null;

  return (
    <div className="mt-6 text-center">
      <div className="text-5xl mb-3">{scorers.length ? '🎉' : '😶'}</div>
      <p className={`text-2xl font-black mb-4 ${scorers.length ? 'text-green-400' : 'text-white/60'}`}>
        {isRace
          ? (winner ? `${winner.name} got it!` : 'Nobody got it')
          : (scorers.length
            ? `${scorers.length} of ${players.length} got it`
            : 'Nobody got it')}
      </p>

      <div className="bg-white/5 rounded-xl p-5 mb-5">
        <p className="text-white text-2xl font-black">{question.animeTitle}</p>
        {question.displayTitle !== question.animeTitle && (
          <p className="text-white/40 text-sm mb-2">{question.displayTitle}</p>
        )}
        <p className="text-white/70 mt-2">
          {question.type === 'OP' ? 'Opening' : 'Ending'}
          {question.sequence ? ` ${question.sequence}` : ''}
          {question.songTitle ? ` — ${question.songTitle}` : ''}
        </p>
      </div>

      {/* Everyone's answer, so a near-miss is visible rather than just "wrong".
          Race only shows the players who actually buzzed. */}
      <div className="bg-white/5 rounded-xl overflow-hidden mb-5">
        {players
          .filter((p) => !isRace || answers[p.id])
          .map((p) => {
            const answer = answers[p.id];
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 text-left">
                <span className="text-lg w-6">{answer?.correct ? '✅' : '❌'}</span>
                <span className="text-white font-bold flex-1">{p.name}</span>
                <span className="text-white/40 text-sm truncate max-w-[55%]">
                  {answer?.text?.trim() ? `“${answer.text}”` : 'passed'}
                </span>
              </div>
            );
          })}
      </div>

      <button
        onClick={onNext}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-xl transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  );
}
