import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import OnlineIdentityCard from '../../../shared/components/OnlineIdentityCard';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { countCharacters } from '../../../shared/utils/profileStats';
import {
  Backdrop, Badge, Banner, Button, Card, Input, Screen, Wordmark,
} from '../../../shared/ui';

export default function RoomSetup({ room, onBack }) {
  // No name box any more — the hub already asked. This screen only ever wanted
  // to know "who am I", and typing that answer fresh each time is what quietly
  // created empty duplicate profiles.
  const { activeProfile: profile, saveProfile, selectProfile } = useProfileStore();
  const [codeInput, setCodeInput] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
          <Card className="mb-6 text-center">
            <p className="mb-4 text-white/60">
              Set your main profile before joining a room — it&apos;s the name and anime
              list you bring to every online game.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => setShowPicker(true)}>
              👤 Choose profile
            </Button>
          </Card>
        )}

        {profile && (
          <div>
            <OnlineIdentityCard
              profile={profile}
              stat={`${countCharacters(profile)} characters`}
              tone="purple"
              onSwitch={() => { setShowPicker(true); setError(''); }}
              onImport={() => setShowImport(true)}
            />

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

        {showPicker && (
          <ProfilePicker
            onClose={() => setShowPicker(false)}
            // No ListManager route from inside a game — the import dialog is
            // the one that matters here, and it is already wired up below.
            // Select first: the row you tapped ✏️ on is not necessarily the
            // active one, and importing into someone else's profile is worse
            // than useless.
            onEditList={(id) => { selectProfile(id); setShowPicker(false); setShowImport(true); }}
          />
        )}

        {showImport && profile && (
          <AniListImport
            profile={profile}
            onClose={() => setShowImport(false)}
            onImported={(merged) => {
              saveProfile(merged);
              setShowImport(false);
            }}
          />
        )}
      </Screen>
    </>
  );
}
