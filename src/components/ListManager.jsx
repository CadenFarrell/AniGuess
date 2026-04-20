import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';

export default function ListManager({ profile, onProfileUpdated }) {
  const { saveProfile } = useProfile();
  const [newAnimeTitle, setNewAnimeTitle] = useState('');
  const [expandedAnime, setExpandedAnime] = useState(null);
  const [addingCharacterTo, setAddingCharacterTo] = useState(null);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [characterForm, setCharacterForm] = useState(emptyCharacterForm());

  function emptyCharacterForm() {
    return { name: '', imageUrl: '', gender: 'Male', role: 'Protagonist', hairColor: '', ability: '', genre: 'Action' };
  }

  const saveUpdatedProfile = (updatedProfile) => {
    saveProfile(updatedProfile);
    onProfileUpdated(updatedProfile);
  };

  const addAnime = () => {
    const title = newAnimeTitle.trim();
    if (!title) return;
    if (profile.animeList.some((a) => a.title.toLowerCase() === title.toLowerCase())) {
      alert('You already have that anime in your list!');
      return;
    }
    saveUpdatedProfile({
      ...profile,
      animeList: [...profile.animeList, { id: Date.now().toString(), title, characters: [] }],
    });
    setNewAnimeTitle('');
  };

  const deleteAnime = (animeId) => {
    if (!window.confirm('Delete this anime and all its characters?')) return;
    saveUpdatedProfile({ ...profile, animeList: profile.animeList.filter((a) => a.id !== animeId) });
  };

  const deleteCharacter = (animeId, charId) => {
    saveUpdatedProfile({ ...profile, animeList: profile.animeList.map((a) => a.id !== animeId ? a : { ...a, characters: a.characters.filter((c) => c.id !== charId) }) });
  };

  const openAddCharacter = (animeId) => {
    setAddingCharacterTo(animeId);
    setEditingCharacter(null);
    setCharacterForm(emptyCharacterForm());
  };

  const openEditCharacter = (animeId, character) => {
    setAddingCharacterTo(animeId);
    setEditingCharacter(character.id);
    setCharacterForm({ ...emptyCharacterForm(), ...character });
  };

  const saveCharacter = (animeId) => {
    const anime = profile.animeList.find((a) => a.id === animeId);
    if (anime.characters.some((c) => c.name.toLowerCase() === characterForm.name.toLowerCase() && c.id !== editingCharacter)) {
      alert('A character with that name already exists in this anime!');
      return;
    }
    const updatedAnimeList = profile.animeList.map((a) => {
      if (a.id !== animeId) return a;
      if (editingCharacter) {
        return { ...a, characters: a.characters.map((c) => c.id === editingCharacter ? { ...characterForm, id: editingCharacter, series: a.title } : c) };
      }
      return { ...a, characters: [...a.characters, { ...characterForm, id: Date.now().toString(), series: a.title }] };
    });
    saveUpdatedProfile({ ...profile, animeList: updatedAnimeList });
    setAddingCharacterTo(null);
    setEditingCharacter(null);
    setCharacterForm(emptyCharacterForm());
  };

  const isFormValid = () => characterForm.name.trim() && characterForm.hairColor.trim() && characterForm.ability.trim();

  const inputClass = 'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 outline-none focus:border-purple-500 transition-colors';
  const selectClass = 'w-full bg-gray-800 border border-white/20 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500 transition-colors';
  const labelClass = 'block text-white/60 text-sm font-semibold mb-1';

  return (
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-black text-white mb-1">{profile.name}'s Anime List</h2>
      <p className="text-white/40 text-sm mb-6">{profile.animeList.length} anime · {profile.animeList.reduce((n, a) => n + a.characters.length, 0)} characters</p>

      {/* Add Anime */}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          value={newAnimeTitle}
          onChange={(e) => setNewAnimeTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newAnimeTitle.trim() && addAnime()}
          placeholder="Add an anime title..."
          className={inputClass}
        />
        <button
          onClick={addAnime}
          disabled={!newAnimeTitle.trim()}
          className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-colors whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {/* Anime List */}
      {profile.animeList.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <div className="text-5xl mb-3">📺</div>
          <p className="text-lg">No anime yet — add one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.animeList.map((anime) => (
            <div key={anime.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              {/* Anime Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
                  className="flex-1 text-left"
                >
                  <span className="text-white font-bold text-lg">{anime.title}</span>
                  <span className="text-white/40 text-sm ml-2">
                    {anime.characters.length === 0 ? '⚠️ No characters' : `${anime.characters.length} character${anime.characters.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="text-white/30 ml-2">{expandedAnime === anime.id ? '▲' : '▼'}</span>
                </button>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => { openAddCharacter(anime.id); setExpandedAnime(anime.id); }}
                    className="px-3 py-2 bg-blue-600/40 hover:bg-blue-600 text-blue-300 hover:text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    + Character
                  </button>
                  <button
                    onClick={() => deleteAnime(anime.id)}
                    className="px-3 py-2 bg-white/5 hover:bg-red-600/40 text-white/40 hover:text-red-300 text-sm rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Expanded: Characters + Form */}
              {expandedAnime === anime.id && (
                <div className="border-t border-white/10 px-5 py-4 space-y-2">
                  {anime.characters.length === 0 && !addingCharacterTo && (
                    <p className="text-white/30 text-sm text-center py-2">No characters yet</p>
                  )}

                  {anime.characters.map((char) => (
                    <div key={char.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/80">{char.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditCharacter(anime.id, char)}
                          className="px-2 py-1 text-sm bg-white/5 hover:bg-white/15 text-white/60 hover:text-white rounded-lg transition-colors"
                        >✏️</button>
                        <button
                          onClick={() => deleteCharacter(anime.id, char.id)}
                          className="px-2 py-1 text-sm bg-white/5 hover:bg-red-600/30 text-white/40 hover:text-red-300 rounded-lg transition-colors"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}

                  {/* Add / Edit Character Form */}
                  {addingCharacterTo === anime.id && (
                    <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
                      <h4 className="text-white font-black text-lg">
                        {editingCharacter ? '✏️ Edit Character' : '➕ Add Character'}
                      </h4>

                      <div>
                        <label className={labelClass}>Name *</label>
                        <input className={inputClass} value={characterForm.name} onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })} placeholder="Character name" />
                      </div>

                      <div>
                        <label className={labelClass}>Image URL (optional)</label>
                        <input className={inputClass} value={characterForm.imageUrl} onChange={(e) => setCharacterForm({ ...characterForm, imageUrl: e.target.value })} placeholder="https://..." />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Gender *</label>
                          <select className={selectClass} value={characterForm.gender} onChange={(e) => setCharacterForm({ ...characterForm, gender: e.target.value })}>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Role *</label>
                          <select className={selectClass} value={characterForm.role} onChange={(e) => setCharacterForm({ ...characterForm, role: e.target.value })}>
                            <option>Protagonist</option>
                            <option>Antagonist</option>
                            <option>Supporting</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Hair Color *</label>
                          <input className={inputClass} value={characterForm.hairColor} onChange={(e) => setCharacterForm({ ...characterForm, hairColor: e.target.value })} placeholder="e.g. Black" />
                        </div>
                        <div>
                          <label className={labelClass}>Genre *</label>
                          <select className={selectClass} value={characterForm.genre} onChange={(e) => setCharacterForm({ ...characterForm, genre: e.target.value })}>
                            <option>Action</option>
                            <option>Romance</option>
                            <option>Comedy</option>
                            <option>Isekai</option>
                            <option>Horror</option>
                            <option>Sci-Fi</option>
                            <option>Sports</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Power / Ability *</label>
                        <input className={inputClass} value={characterForm.ability} onChange={(e) => setCharacterForm({ ...characterForm, ability: e.target.value })} placeholder="e.g. Stretches body like rubber" />
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => { setAddingCharacterTo(null); setEditingCharacter(null); }}
                          className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                        >Cancel</button>
                        <button
                          onClick={() => saveCharacter(anime.id)}
                          disabled={!isFormValid()}
                          className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-colors"
                        >
                          {editingCharacter ? 'Save Changes' : 'Add Character'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
