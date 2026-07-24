import { RACE } from '../rules';
import { Button, Card, CardRow } from '../../../shared/ui';

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
      <div className="mb-3 text-5xl">{scorers.length ? '🎉' : '😶'}</div>
      <p
        className={`mb-4 font-display text-2xl font-extrabold ${
          scorers.length ? 'text-pop-lime' : 'text-white/60'
        }`}
      >
        {isRace
          ? (winner ? `${winner.name} got it!` : 'Nobody got it')
          : (scorers.length
            ? `${scorers.length} of ${players.length} got it`
            : 'Nobody got it')}
      </p>

      <Card padding="lg" className="mb-5">
        <p className="font-display text-2xl font-extrabold text-white">{question.animeTitle}</p>
        {question.displayTitle !== question.animeTitle && (
          <p className="mb-2 text-sm text-white/40">{question.displayTitle}</p>
        )}
        <p className="mt-2 text-white/70">
          {question.type === 'OP' ? 'Opening' : 'Ending'}
          {question.sequence ? ` ${question.sequence}` : ''}
          {question.songTitle ? ` — ${question.songTitle}` : ''}
        </p>
      </Card>

      {/* Everyone's answer, so a near-miss is visible rather than just "wrong".
          Race only shows the players who actually buzzed. */}
      <Card padding="sm" className="mb-5">
        {players
          .filter((p) => !isRace || answers[p.id])
          .map((p) => {
            const answer = answers[p.id];
            return (
              <CardRow key={p.id} className="text-left">
                <span className="w-6 text-lg">{answer?.correct ? '✅' : '❌'}</span>
                <span className="min-w-0 flex-1 truncate font-display font-extrabold text-white">
                  {p.name}
                </span>
                <span className="max-w-[55%] truncate text-sm text-white/40">
                  {answer?.text?.trim() ? `“${answer.text}”` : 'passed'}
                </span>
              </CardRow>
            );
          })}
      </Card>

      <Button variant="secondary" size="lg" fullWidth onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
