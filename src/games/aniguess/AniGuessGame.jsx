import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import { firebaseEnabled } from '../../shared/services/firebase';
import { Backdrop, Button, GhostButton, Screen, Wordmark } from '../../shared/ui';

export default function AniGuessGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <>
      <Backdrop />
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
          <div className="mt-2 text-center">
            <GhostButton onClick={onExit}>← Back to hub</GhostButton>
          </div>
        </div>
      </Screen>
    </>
  );
}
