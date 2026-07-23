import { Banner } from '../../../shared/ui';

// Online-only. A remote player's turn ends the instant they ask or guess, so
// without this the answer to their question — or the fact that their guess was
// wrong — would never reach the screen they're actually looking at. Shows the
// most recent resolved action to everyone until the next one replaces it.
export default function LastOutcomeBanner({ outcome }) {
  if (!outcome) return null;

  const tone = outcome.kind === 'guess'
    ? 'danger'
    : outcome.answer === 'Yes'
      ? 'success'
      : 'info';

  return (
    <Banner tone={tone} className="mb-5 text-center">
      {outcome.kind === 'guess' ? (
        <p className="text-white/80">
          ❌ <strong className="text-white">{outcome.name}</strong> guessed &quot;{outcome.text}
          &quot; — not correct.
        </p>
      ) : outcome.kind === 'question' ? (
        <p className="text-white/80">
          <strong className="text-white">{outcome.name}</strong> asked &quot;{outcome.text}&quot; —{' '}
          <strong className={outcome.answer === 'Yes' ? 'text-pop-lime' : 'text-pop-red'}>
            {outcome.answer}
          </strong>
        </p>
      ) : (
        <p className="text-white/80">
          ⏱️ <strong className="text-white">{outcome.name}</strong>&apos;s turn ended.
        </p>
      )}
    </Banner>
  );
}
