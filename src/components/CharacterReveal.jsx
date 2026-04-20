export default function CharacterReveal({ character, guesserName, onStartQuestioning, isLastPlayer }) {
  const facts = [
    { emoji: '📺', label: 'Series', value: character.series },
    { emoji: '🎭', label: 'Role', value: character.role },
    { emoji: '👤', label: 'Gender', value: character.gender },
    { emoji: '📖', label: 'Description', value: character.ability || character.description },
    { emoji: '🎬', label: 'Genre', value: Array.isArray(character.genres) ? character.genres.join(', ') : character.genre },
  ].filter((f) => f.value);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl text-center">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mb-8">
          🎭 Character Reveal
        </h2>

        <div className="flex justify-center mb-4">
          <div className="w-64 h-64 rounded-2xl overflow-hidden border-4 border-purple-500 shadow-lg shadow-purple-900/50">
            {character.imageUrl ? (
              <img
                src={character.imageUrl}
                alt="character"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-7xl text-white/30">?</div>
            )}
          </div>
        </div>

        <h3 className="text-3xl font-black text-white mb-6">{character.name}</h3>

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
