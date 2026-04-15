import { useState } from 'react';

export default function CharacterAssignment({ guesser, onCharacterAssigned, assignmentNumber, totalPlayers }) {
  const [step, setStep] = useState('lookaway');
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [expandedAnime, setExpandedAnime] = useState(null);
  const [browseMode, setBrowseMode] = useState(false);

  const getAllCharacters = () =>
    guesser.animeList.flatMap((anime) =>
      anime.characters.map((char) => ({ ...char, series: anime.title }))
    );

  const pickRandom = () => {
    const all = getAllCharacters();
    setSelectedCharacter(all[Math.floor(Math.random() * all.length)]);
    setStep('confirm');
  };

  const pickManual = (character) => {
    setSelectedCharacter(character);
    setStep('confirm');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">

        {/* Progress */}
        <p className="text-white/40 text-center text-base mb-8">
          Assigning characters — {assignmentNumber} of {totalPlayers}
        </p>

        {step === 'lookaway' && (
          <div className="text-center">
            <div className="text-7xl mb-5">📵</div>
            <h2 className="text-4xl font-black text-white mb-3">
              {guesser.name}, look away!
            </h2>
            <p className="text-white/60 text-lg mb-10">
              Everyone else — get ready to pick a character for {guesser.name}.
            </p>
            <button
              onClick={() => setStep('assign')}
              className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-2xl rounded-xl shadow-lg transition-all"
            >
              {guesser.name} is looking away — Ready! ✅
            </button>
          </div>
        )}

        {step === 'assign' && !browseMode && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-2">Pick a character for</h2>
            <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mb-10">
              {guesser.name}
            </h3>
            <div className="flex flex-col gap-5">
              <button
                onClick={pickRandom}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-2xl rounded-xl shadow-lg transition-all"
              >
                🎲 Pick Random
              </button>
              <button
                onClick={() => setBrowseMode(true)}
                className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-2xl rounded-xl shadow-lg transition-all"
              >
                🔍 Pick Manually
              </button>
            </div>
          </div>
        )}

        {step === 'assign' && browseMode && (
          <>
            <div className="flex items-center gap-4 mb-5">
              <button
                onClick={() => setBrowseMode(false)}
                className="text-white/60 hover:text-white transition-colors text-lg"
              >
                ← Back
              </button>
              <h2 className="text-2xl font-black text-white">
                {guesser.name}'s Characters
              </h2>
            </div>
            {guesser.animeList.map((anime) => (
              <div key={anime.id} className="mb-4">
                <button
                  onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
                  className="w-full text-left px-5 py-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white font-bold text-lg transition-colors"
                >
                  {expandedAnime === anime.id ? '▼' : '▶'} {anime.title}
                  <span className="text-white/40 font-normal ml-2">({anime.characters.length})</span>
                </button>
                {expandedAnime === anime.id && (
                  <div className="mt-3 space-y-3 pl-2">
                    {anime.characters.map((char) => (
                      <div key={char.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center text-white/40 font-bold text-xl">?</div>
                        )}
                        <div className="flex-1 text-left">
                          <p className="text-white font-bold text-lg">{char.name}</p>
                          <p className="text-white/50 text-base">{char.gender} · {char.role} · {char.genre}</p>
                        </div>
                        <button
                          onClick={() => pickManual({ ...char, series: anime.title })}
                          className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors text-base"
                        >
                          Pick
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {step === 'confirm' && selectedCharacter && (
          <div className="text-center">
            <h2 className="text-3xl font-black text-white mb-8">Confirm this character?</h2>
            <div className="bg-white/10 border-2 border-purple-500 rounded-2xl p-8 mb-8">
              {selectedCharacter.imageUrl ? (
                <img src={selectedCharacter.imageUrl} alt={selectedCharacter.name}
                  className="w-36 h-36 rounded-xl object-cover mx-auto mb-4" />
              ) : (
                <div className="w-36 h-36 rounded-xl bg-white/10 flex items-center justify-center text-5xl mx-auto mb-4">?</div>
              )}
              <h3 className="text-3xl font-black text-white">{selectedCharacter.name}</h3>
              <p className="text-white/60 text-lg">from {selectedCharacter.series}</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => { setStep('assign'); setSelectedCharacter(null); }}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-bold text-lg rounded-xl transition-colors"
              >
                ← Pick Again
              </button>
              <button
                onClick={() => onCharacterAssigned(selectedCharacter)}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-lg rounded-xl transition-all"
              >
                ✅ Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
