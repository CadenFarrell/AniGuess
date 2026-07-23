import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import AniListImport from '../../../shared/components/AniListImport';

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

  if (room.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-red-400 font-bold mb-6">{room.error}</p>
        <button onClick={onBack} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl">← Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-white/60 hover:text-white text-lg mb-6">← Back</button>
        <h2 className="text-3xl font-black text-white mb-6">🌐 Play Online</h2>

        {!profile && (
          <div>
            <label className="block text-white/60 text-sm font-semibold mb-1">Your name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && confirmName()}
              placeholder="Enter your name..."
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-purple-500 mb-4"
            />
            <button
              onClick={confirmName}
              disabled={!nameInput.trim()}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {profile && (
          <div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-white font-bold">{profile.name}</p>
                <p className="text-white/40 text-sm">
                  {profile.animeList.reduce((s, a) => s + a.characters.length, 0)} characters
                </p>
              </div>
              <button onClick={() => setShowImport(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg">
                🔗 Import from AniList
              </button>
            </div>

            {error && <p className="text-red-400 text-center mb-4">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={busy}
              className="w-full py-4 mb-4 bg-gradient-to-r from-green-600 to-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
            >
              {busy ? 'Creating…' : '➕ Create Room'}
            </button>

            <div className="flex gap-3">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && codeInput.trim() && handleJoin()}
                placeholder="Room code"
                maxLength={5}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-lg text-center tracking-widest placeholder-white/40 outline-none focus:border-purple-500"
              />
              <button
                onClick={handleJoin}
                disabled={busy || !codeInput.trim()}
                className="px-6 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-colors"
              >
                Join
              </button>
            </div>
          </div>
        )}

        {room.roomCode && (
          <p className="text-white/60 text-center mt-6">
            Room code: <span className="text-white font-black text-2xl tracking-widest">{room.roomCode}</span>
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
      </div>
    </div>
  );
}
