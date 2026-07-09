import { useState } from 'react';
import { normalizeCharacter } from '../utils/character';

export default function CharacterReveal({ character, guesserName, onStartQuestioning, isLastPlayer }) {
  const [imgError, setImgError] = useState(false);

  // Reset the broken-image fallback when the character changes (setState
  // during render — this component doesn't remount between players in
  // the assignment flow, so there's no other hook to key this off of).
  const [prevImageUrl, setPrevImageUrl] = useState(character.imageUrl);
  if (prevImageUrl !== character.imageUrl) {
    setPrevImageUrl(character.imageUrl);
    setImgError(false);
  }

  // Normalize defensively — a character just edited via ListManager mid-session
  // may still have the raw (unnormalized) shape until the profile is reloaded.
  const c = normalizeCharacter(character);

  const facts = [
    { emoji: '📺', label: 'Series', value: c.series },
    { emoji: '🎭', label: 'Role', value: c.role },
    { emoji: '👤', label: 'Gender', value: c.gender },
    { emoji: '💇', label: 'Hair Color', value: c.hairColor },
    { emoji: '⚡', label: 'Ability', value: c.ability },
    { emoji: '📖', label: 'Description', value: c.description },
    { emoji: '🎬', label: 'Genre', value: c.genres.join(', ') },
  ].filter((f) => f.value);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-4xl font-black mb-8">
          🎭 <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">Character Reveal</span>
        </h2>

        <div className="flex justify-center mb-4">
          <div className="w-64 h-64 rounded-2xl overflow-hidden border-4 border-purple-500 shadow-lg shadow-purple-900/50">
            {c.imageUrl && !imgError ? (
              <img
                src={c.imageUrl}
                alt="character"
                loading="lazy"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-7xl text-white/30">?</div>
            )}
          </div>
        </div>

        <h3 className="text-3xl font-black text-white mb-6">{c.name}</h3>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-3">
          {facts.map((fact, i) => (
            <div key={i} className="flex items-start gap-4 text-white">
              <span className="text-2xl flex-shrink-0">{fact.emoji}</span>
              <div>
                <span className="text-white/40 text-sm uppercase tracking-wide">{fact.label}</span>
                <p className="text-white/80 text-lg">{fact.value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-white/50 italic text-lg mb-8">
          Memorize this, then pass the device to <strong className="text-white">{guesserName}</strong>
        </p>

        <button
          onClick={onStartQuestioning}
          className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-2xl rounded-xl shadow-lg transition-all"
        >
          {isLastPlayer ? '🎮 Start Game!' : '➡️ Next Player'}
        </button>
      </div>
    </div>
  );
}
