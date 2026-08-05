import { useState } from 'react';
import { MAX_STEAL_LEN } from '../rules';
import { Backdrop, Button, Card, Input, Screen, Wordmark } from '../../../shared/ui';

// A caught fake's one shot: name the secret and take a point back. Blind mode
// only — in decoy mode they were dealt a character of their own and have
// nothing to steal, so this phase never runs.
//
// Typed rather than picked off a grid, because there is no board to pick from
// anymore. That makes it a genuinely harder shot than tapping one of sixteen,
// which is the intent: the clues have to have told them something. Spelling is
// forgiven — rules.stealIsCorrect folds case and diacritics, so nobody loses a
// point to a missing macron.
export default function StealScreen({ fakeName = '', isMine, onSteal }) {
  const [text, setText] = useState('');
  const guess = text.trim();

  if (!isMine) {
    return (
      <>
        <Backdrop />
        <Screen center>
          <Wordmark tone="teal" size="md" level={2} className="mb-8">🎣 Caught!</Wordmark>
          <Card padding="lg" className="text-center">
            <div className="text-5xl">🕵️</div>
            <p className="mt-3 font-display text-2xl font-extrabold text-white">
              {fakeName} was the fake
            </p>
            <p className="mt-2 text-white/60">
              They get one guess at the character. If they nail it, they take a point back.
            </p>
          </Card>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Backdrop />
      <Screen center>
        <Wordmark tone="teal" size="sm" level={2} className="mb-4">🎣 You were caught</Wordmark>
        <p className="mb-8 text-center text-white/60">
          One guess. Who was everyone talking about?
        </p>

        <Card padding="lg" className="mb-6 w-full border-pop-teal">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && guess) onSteal(guess); }}
            placeholder="Character name…"
            maxLength={MAX_STEAL_LEN}
            autoFocus
            aria-label="The character you think they were describing"
          />
          <p className="mt-2 text-base text-white/40">
            Spelling is forgiven — capitals and accents don&apos;t matter.
          </p>
        </Card>

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!guess}
          onClick={() => onSteal(guess)}
        >
          {guess ? `🎯 Lock in ${guess}` : 'Name a character'}
        </Button>
      </Screen>
    </>
  );
}
