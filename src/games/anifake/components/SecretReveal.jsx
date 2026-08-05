import { useState } from 'react';
import SecretCard from './SecretCard';
import { Backdrop, Button, Screen, Wordmark } from '../../../shared/ui';

// Local play only: one device, several people, so each card has to be looked at
// alone. Two taps per player — claim the device, then hide and pass it on —
// with the card never on screen either side of that.
//
// Online needs none of this: the card is shown inline above the clue log,
// because the device is already private. That also spares the room a readiness
// gate, and every readiness gate is one more thing a closed tab can wedge.
export default function SecretReveal({ player, card, isLast, onNext }) {
  const [showing, setShowing] = useState(false);

  return (
    <>
      <Backdrop />
      <Screen center>
        {!showing ? (
          <>
            <Wordmark tone="teal" size="md" level={2} className="mb-8">
              🕵️ Pass the device
            </Wordmark>
            <p className="mb-2 text-center text-xl text-white/60">Hand it to</p>
            <p className="mb-10 text-center font-display text-4xl font-extrabold text-white">
              {player.name}
            </p>
            <Button variant="primary" size="xl" fullWidth onClick={() => setShowing(true)}>
              👀 I&apos;m {player.name} — show me
            </Button>
          </>
        ) : (
          <>
            <Wordmark tone="teal" size="sm" level={2} className="mb-6">
              {player.name}
            </Wordmark>
            <div className="mb-8">
              <SecretCard card={card} />
            </div>
            {/* True of the fake's one-word hint as much as of a character:
                local play shows the card once and there is no private device to
                keep it on, so the word has to be held in your head. */}
            <p className="mb-6 text-center text-white/50">
              Memorize it — you won&apos;t see it again until the reveal.
            </p>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => { setShowing(false); onNext(); }}
            >
              {isLast ? '🙈 Hide & start the clues' : '🙈 Hide & pass on'}
            </Button>
          </>
        )}
      </Screen>
    </>
  );
}
