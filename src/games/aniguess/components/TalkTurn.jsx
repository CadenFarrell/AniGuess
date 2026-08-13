import { Button, Card } from '../../../shared/ui';

// The whole talk-mode action area: one screen, one tap, turn over.
//
// Every talk-mode turn ends in exactly one of four outcomes — rules.js advances
// the turn on all of them — so asking "question or guess?" first was a tap that
// carried no information the second tap didn't already carry. Both pairs are on
// screen at once and the table taps what actually happened.
//
// There is deliberately no "← Back": nothing is staged, so there is nothing to
// back out of. That also retires the old trap where tapping "Ask a Question"
// committed you to spending the turn, with no way out but answering.
export default function TalkTurn({ guesserName, onAnswer, onJudgeGuess, trail = [] }) {
  return (
    <div className="mb-5">
      <div className="card-pop p-6 text-center">
        <div className="text-5xl">🗣️</div>
        <p className="mt-3 font-display text-2xl font-extrabold text-white">
          {guesserName}, ask a yes/no question or guess out loud
        </p>
        <p className="mt-2 text-base text-white/50">
          Everyone else — tap what happened
        </p>

        <Group label="They asked a question">
          <Button variant="success" size="xl" className="flex-1" onClick={() => onAnswer('Yes')}>
            ✅ Yes
          </Button>
          <Button variant="danger" size="xl" className="flex-1" onClick={() => onAnswer('No')}>
            ❌ No
          </Button>
        </Group>

        <Group label="They guessed a character">
          <Button variant="success" size="xl" className="flex-1" onClick={() => onJudgeGuess(true)}>
            🎯 Got it!
          </Button>
          <Button variant="danger" size="xl" className="flex-1" onClick={() => onJudgeGuess(false)}>
            ❌ Wrong
          </Button>
        </Group>
      </div>

      {trail.length > 0 && (
        <Card title={`${guesserName}'s answers so far`} padding="sm" className="mt-4">
          {/* Wraps rather than scrolls — a long game is a long row, and a
              horizontal scrollbar would hide the oldest answers, which are
              exactly the ones a player is trying to remember. */}
          <div className="flex flex-wrap gap-2">
            {trail.map((chip) => (
              <span
                key={chip.id}
                title={chip.label}
                className={`rounded-pop-sm border-2 px-2 py-1 text-base ${TONES[chip.tone]}`}
              >
                {chip.icon}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// The chip carries its meaning in the emoji, so the tint is reinforcement, not
// the signal — and `title` gives the same thing in words to a screen reader.
const TONES = {
  yes: 'border-pop-lime/40 bg-pop-lime/10',
  no: 'border-pop-red/40 bg-pop-red/10',
  warn: 'border-pop-amber/40 bg-pop-amber/10',
};

// A labelled pair of buttons. The rule either side of the label is what stops
// the four buttons reading as one undifferentiated grid of taps.
function Group({ label, children }) {
  return (
    <>
      <div className="mt-6 flex items-center gap-3">
        <span className="h-0.5 flex-1 bg-white/10" />
        <span className="font-display text-xs font-extrabold uppercase tracking-widest text-white/40">
          {label}
        </span>
        <span className="h-0.5 flex-1 bg-white/10" />
      </div>
      <div className="mt-3 flex gap-4">{children}</div>
    </>
  );
}
