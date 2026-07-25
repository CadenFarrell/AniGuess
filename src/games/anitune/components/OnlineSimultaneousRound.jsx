import GuessInput from './GuessInput';
import { Badge, Button, GhostButton } from '../../../shared/ui';

// Everyone-guesses mode, one player per device. No device to pass round — each
// player types their own answer at the same time, and the room hook holds the
// reveal until everyone is in. Since a player only ever sees their own screen the
// input isn't masked (unlike the local pass-and-play version), and other players'
// answers stay hidden here until the reveal so nobody copies.
export default function OnlineSimultaneousRound({
  players, questions, question, game, myPlayerId,
  iHaveAnswered, clipStarted,
  onSubmit, onReveal,
}) {
  const answers = game.answers || {};
  const submittedCount = players.filter((p) => answers[p.id]).length;
  const waitingOn = players.filter((p) => !answers[p.id]);

  // Who's locked in — names only, never their guess or whether it was right.
  const strip = (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {players.map((p) => {
        const locked = Boolean(answers[p.id]);
        return (
          <Badge key={p.id} tone={locked ? 'lime' : 'neutral'}>
            {locked ? '🔒' : '✍️'} {p.name}
            {p.id === myPlayerId ? ' (you)' : ''}
          </Badge>
        );
      })}
    </div>
  );

  if (iHaveAnswered) {
    return (
      <div className="mt-6 text-center">
        <div className="mb-3 text-5xl">🔒</div>
        <p className="font-display text-xl font-extrabold text-white">Locked in</p>
        <p className="mt-1 text-white/50">
          {waitingOn.length
            ? `Waiting on ${waitingOn.map((p) => p.name).join(', ')}…`
            : 'Revealing…'}
        </p>
        {strip}
      </div>
    );
  }

  if (!clipStarted) {
    return (
      <div className="mt-6 text-center">
        <p className="text-base text-white/60">Listen for the clip — you&apos;ll get to guess.</p>
        {strip}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="mb-1 text-center font-display text-xl font-extrabold text-white">
        Which anime is this?
      </p>
      <p className="mb-4 text-center text-sm text-white/30">
        Everyone types at once — {submittedCount}/{players.length} locked in.
      </p>
      <GuessInput
        key={question.id}
        questions={questions}
        placeholder="Type your answer…"
        submitLabel="Lock in 🔒"
        skipLabel="Pass"
        onSubmit={(text) => onSubmit(text)}
        onSkip={() => onSubmit('')}
      />
      {strip}
      {/* Escape hatch so an away player can't freeze the round forever. */}
      <div className="mt-4 text-center">
        <GhostButton onClick={onReveal}>Reveal now</GhostButton>
      </div>
    </div>
  );
}
