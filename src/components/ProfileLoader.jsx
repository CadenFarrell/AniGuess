import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';

export default function ProfileLoader({ onProfileLoaded }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const { loadOrCreateProfile } = useProfile();

  const handleSubmit = () => {
    const { profile, isNew } = loadOrCreateProfile(name);
    setMessage(
      isNew
        ? `New profile created for ${profile.name}!`
        : `Welcome back, ${profile.name}! ${profile.animeList.length} anime in your list.`
    );
    if (onProfileLoaded) onProfileLoaded(profile);
    setName('');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>AniGuess</h1>
      <h2>Enter Your Name</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name..."
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
      >
        Add Player
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}