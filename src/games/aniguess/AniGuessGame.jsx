import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import { firebaseEnabled } from '../../shared/services/firebase';
import { Backdrop, Button, HubButton, Screen, Wordmark } from '../../shared/ui';

export default function AniGuessGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  // Same onBack OnlineGame has always had: local play could otherwise only leave
  // by the Hub button, so switching to online meant a full round-trip through it.
  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <>
      <Backdrop />
      {/* The menu is an in-game screen too, so the way home stays in the same
          corner here as it does everywhere past it. */}
      <HubButton onClick={onExit} />
      <Screen center>
        <Wordmark tone="pink" subtitle="The anime character guessing game" className="mb-10">
          AniGuess
        </Wordmark>
        <div className="flex flex-col gap-4">
          <Button variant="primary" size="xl" fullWidth onClick={() => setMode('local')}>
            📱 Play on this device
          </Button>
          <Button
            variant="secondary"
            size="xl"
            fullWidth
            onClick={() => setMode('online')}
            disabled={!firebaseEnabled}
            title={!firebaseEnabled ? 'Online play requires Firebase configuration (see .env.local.example)' : ''}
          >
            🌐 Play Online {!firebaseEnabled && '(not configured)'}
          </Button>
        </div>
      </Screen>
    </>
  );
}
