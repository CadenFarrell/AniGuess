import { useState } from 'react';
import { Badge, Button, Card, Screen, TimerBar } from '../../../shared/ui';
import ClueCard from './ClueCard';
import Dial from './Dial';

// A guesser's turn. The target is not passed in — not hidden by a style, not
// rendered behind a flag: the local hook withholds it from its return value
// during the guess phase, and online it is in a node this device cannot read.
//
// The dial starts UNPLACED rather than at the midpoint. A pre-placed dial is an
// answer the game supplied, and at the centre of a spectrum it is a suspiciously
// good one — it would score points for a player who did nothing, and skew the
// psychic's mean toward the middle of the track.
//
// `timer` is what useDeadline returns, or null — passed through rather than
// computed here so this screen stays dumb. Null in local play, where the guess
// phase is a hot seat and one shared countdown would be measuring the wrong
// thing.
//
// A DIAL THAT IS PLACED WHEN THE CLOCK RUNS OUT SUBMITS ITSELF — but not from
// here. All this screen does with `expired` is stop taking input and say so;
// the submit lives in OnlineGame, because the question "have I already locked?"
// has a real answer up there (`iHaveDialled`, off the round itself) and down
// here it would have to be a latch. A ref latch cannot be read during render to
// caption the result, and a state latch is a setState inside an effect: the two
// react-hooks rules close off both, which is the lint agreeing with where the
// logic belonged anyway.
//
// What it replaces is worth naming: this screen used to read `secondsLeft` for
// the bar and ignore `expired` entirely, so the psychic's reveal landed on
// players still holding a dial they had visibly placed, scored "no dial" — the
// row the reveal draws for somebody whose tab closed. help.js promises the round
// scores "whatever dials are in", and a dial sitting on screen is in. Never
// touching it still scores nothing, so the other half of that promise stands.
export default function GuessView({
  spectrum, clue, card = null, mode = 'text', value, onChange, onLock, who, timer = null,
  waitingFor = null, psychicName = null,
}) {
  const [touched, setTouched] = useState(Number.isFinite(value));
  const placed = touched && Number.isFinite(value);
  const expired = timer?.expired === true;

  // What the table is being asked. In readroom the card is not a clue at all —
  // it is the subject, and the question is about the psychic rather than about
  // the card, so saying so is the difference between the round making sense and
  // not. The other two modes are both "here is what they gave you".
  const prompt = mode === 'readroom'
    ? `Where did ${psychicName || 'the psychic'} put it?`
    : 'The clue';

  return (
    <Screen>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold text-white">
          {who ? `${who}'s guess` : 'Your guess'}
        </h2>
        {waitingFor != null && <Badge tone="amber">{waitingFor}</Badge>}
      </div>

      {timer && (
        <TimerBar
          secondsLeft={timer.secondsLeft}
          fraction={timer.fraction}
          label="Time to dial"
          className="mb-6"
        />
      )}

      <Card padding="lg" className="mb-6 text-center">
        <p className="font-display text-sm font-extrabold uppercase tracking-widest text-white/50">
          {prompt}
        </p>
        {card ? (
          <ClueCard card={card} size="lg" className="mt-4" />
        ) : (
          <p className="mt-3 font-display text-3xl font-extrabold text-white">“{clue}”</p>
        )}
      </Card>

      <Card padding="lg" className="mb-6">
        <Dial
          spectrum={spectrum}
          value={placed ? value : null}
          disabled={expired}
          onChange={(v) => { setTouched(true); onChange(v); }}
        />
        {expired ? (
          <p className="mt-4 text-center text-base text-white/40">
            {/* `placed` is still true here, because the auto-lock deliberately
                leaves the draft alone — see OnlineGame. This screen is replaced
                the moment the write lands. */}
            {placed
              ? "Time's up — your dial went in where you left it."
              : "Time's up — no dial to score."}
          </p>
        ) : !placed && (
          <p className="mt-4 text-center text-base text-white/40">
            Tap the dial to place it — then drag, nudge, or use the arrow keys.
          </p>
        )}
      </Card>

      <Button
        variant="primary"
        size="xl"
        fullWidth
        disabled={!placed || expired}
        onClick={onLock}
      >
        {expired ? 'Revealing…' : 'Lock it in'}
      </Button>
    </Screen>
  );
}
