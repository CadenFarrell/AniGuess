import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import { firebaseEnabled } from '../../shared/services/firebase';
import { Backdrop, Button, GhostButton, Screen, Wordmark } from '../../shared/ui';

export default function AniFakeGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <>
      <Backdrop />
      <Screen center>
        <Wordmark
          tone="teal"
          subtitle="Everyone knows the character. One of you is faking it."
          className="mb-10"
        >
          AniFake
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
          <div className="mt-2 text-center">
            <GhostButton onClick={onExit}>← Back to hub</GhostButton>
          </div>
        </div>
      </Screen>
    </>
  );
}
