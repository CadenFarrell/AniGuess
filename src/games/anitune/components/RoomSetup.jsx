import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import OnlineIdentityCard from '../../../shared/components/OnlineIdentityCard';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { countShows } from '../../../shared/utils/profileStats';
import {
  Backdrop, Badge, Banner, Button, Card, Input, Screen, Wordmark,
} from '../../../shared/ui';

// Create/join a room. Adapted from src/games/aniguess/components/RoomSetup.jsx —
// same flow, but AniTune cares about how many shows a player has on their list
// rather than characters. The profile itself comes from the hub, shared with
// AniGuess (both keyed on aniguess_profiles).
export default function RoomSetup({ room, onBack }) {
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
        <Wordmark tone="blue" size="md" level={2} className="mb-8">
          🌐 Play Online
        </Wordmark>

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
              stat={`${countShows(profile)} shows`}
              tone="blue"
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
