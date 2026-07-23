import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import AniListImport from '../../../shared/components/AniListImport';
import {
  Backdrop, Badge, Banner, Button, Card, Input, Label, Screen, Wordmark,
} from '../../../shared/ui';

export default function RoomSetup({ room, onBack }) {
  const { loadOrCreateProfile, saveProfile } = useProfile();
  const [nameInput, setNameInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [profile, setProfile] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirmName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { profile: p } = loadOrCreateProfile(trimmed);
    setProfile(p);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    try {
      await room.createRoom(profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!codeInput.trim()) return;
    setBusy(true);
    setError('');
    try {
      await room.joinRoom(codeInput, profile);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Backdrop />
      <Screen onBack={onBack}>
        <Wordmark tone="purple" size="md" level={2} className="mb-8">
          🌐 Play Online
        </Wordmark>

        {/* Connection-level problems (sign-in failure, a saved room that
            vanished). Dismissible — the join form below still works. */}
        {room.error && (
          <Banner tone="danger" onDismiss={room.dismissError} className="mb-5">
            ⚠️ {room.error}
          </Banner>
        )}

        {!profile && (
          <div>
            <Label htmlFor="room-name">Your name</Label>
            <Input
              id="room-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && confirmName()}
              placeholder="Enter your name..."
              autoFocus
              className="mb-4 text-lg"
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={confirmName}
              disabled={!nameInput.trim()}
            >
              Continue
            </Button>
          </div>
        )}

        {profile && (
          <div>
            <Card className="mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-extrabold text-white truncate">{profile.name}</p>
                <p className="text-white/40 text-sm">
                  {profile.animeList.reduce((s, a) => s + a.characters.length, 0)} characters
                </p>
                {/* Player ids come from the name, so a room rejects a second
                    person using the same one — make switching easy. */}
                <button
                  onClick={() => { setProfile(null); setError(''); }}
                  className="focus-pop mt-1 rounded-pop-sm text-sm text-pop-purple hover:text-white"
                >
                  change name
                </button>
              </div>
              <Button
                variant="neutral"
                size="sm"
                className="flex-shrink-0"
                onClick={() => setShowImport(true)}
              >
                🔗 Import from AniList
              </Button>
            </Card>

            {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

            <Button
              variant="success"
              size="lg"
              fullWidth
              className="mb-4"
              onClick={handleCreate}
              disabled={busy}
            >
              {busy ? 'Creating…' : '➕ Create Room'}
            </Button>

            <div className="flex gap-3">
              <Input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && codeInput.trim() && handleJoin()}
                placeholder="Room code"
                maxLength={5}
                aria-label="Room code"
                className="flex-1 text-center text-lg font-display font-extrabold tracking-widest"
              />
              <Button
                variant="secondary"
                size="lg"
                onClick={handleJoin}
                disabled={busy || !codeInput.trim()}
              >
                Join
              </Button>
            </div>
          </div>
        )}

        {room.roomCode && (
          <p className="mt-6 text-center text-white/60">
            Room code:{' '}
            <Badge tone="lime" className="ml-1 text-lg tracking-widest">{room.roomCode}</Badge>
          </p>
        )}

        {showImport && (
          <AniListImport
            profile={profile}
            onClose={() => setShowImport(false)}
            onImported={(merged) => {
              saveProfile(merged);
              setProfile(merged);
              setShowImport(false);
            }}
          />
        )}
      </Screen>
    </>
  );
}
