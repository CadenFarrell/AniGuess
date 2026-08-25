import { useState } from 'react';
import LocalGame from './LocalGame';
import OnlineGame from './OnlineGame';
import { firebaseEnabled } from '../../shared/services/firebase';
import { Backdrop, Button, HubButton, Screen, Wordmark } from '../../shared/ui';

export default function AniTagGame({ onExit }) {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <LocalGame onExit={onExit} onBack={() => setMode(null)} />;
  if (mode === 'online') return <OnlineGame onBack={() => setMode(null)} onExit={onExit} />;

  return (
    <>
      <Backdrop />
      {/* The menu is an in-game screen too, so the way home stays in the same
          corner here as it does everywhere past it. */}
      <HubButton onClick={onExit} />
      <Screen center>
        <Wordmark
          tone="lime"
          // Mode-neutral on purpose: this screen sits BEFORE the setting that
          // decides whether the hidden clause is yours or somebody else's, so
          // naming either half here would be wrong half the time.
          subtitle="Everyone has a secret category. Name things until you work one out."
          className="mb-10"
        >
          AniTag
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
