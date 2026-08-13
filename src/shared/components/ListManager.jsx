import { useState } from 'react';
import { useProfileStore } from '../context/profileContext';
import { normalizeTitle } from '../utils/ranking';
import AniListImport from './AniListImport';
import { Button, Field, Input, Select } from '../ui';

// `className` carries the top padding, because the two callers genuinely differ:
// AniGuess renders its own back/player-switcher header above this and needs only
// a small gap (`pt-4`), while the hub renders nothing but the fixed 🏠 Hub button
// and needs to clear it (`pt-16`). It is a prop rather than a baked-in default
// plus an override because two conflicting Tailwind `pt-` utilities on one element
// resolve by CSS source order, not by the order they appear in the attribute.
export default function ListManager({ profile, onProfileUpdated, className = '' }) {
  // Through the store, not useProfile directly: an edit here has to reach the
  // hub's profile chip and any game holding the same profile, which a bare
  // localStorage write does not do.
  const { saveProfile } = useProfileStore();
  const hasProfile = Boolean(profile);
  const [newAnimeTitle, setNewAnimeTitle] = useState('');
  const [expandedAnime, setExpandedAnime] = useState(null);
  const [addingCharacterTo, setAddingCharacterTo] = useState(null);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [characterForm, setCharacterForm] = useState(emptyCharacterForm());
  // 'pick' opens the checklist; 'refresh' skips straight to importing whatever
  // is new. null means closed.
  const [importMode, setImportMode] = useState(null);

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
    if (profile.animeList.some((a) => normalizeTitle(a.title) === normalizeTitle(title))) {
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

  // Reachable if a caller navigates here without picking a player first —
  // render an empty state rather than crashing on profile.animeList.
  if (!hasProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-center text-lg text-white/50">Pick a player to edit their list.</p>
      </div>
    );
  }

  return (
    // Not a <Screen>: the head-room above this body is the caller's call — see
    // the note on `className` at the top of the file.
    <div className={`mx-auto min-h-screen max-w-2xl px-5 pb-8 sm:px-6 ${className}`}>
      <h2 className="font-display text-3xl font-extrabold text-white">{profile.name}&apos;s Anime List</h2>
      <p className="mb-6 text-sm text-white/40">
        {profile.animeList.length} anime · {profile.animeList.reduce((n, a) => n + a.characters.length, 0)} characters
      </p>

      {/* Add Anime */}
      <div className="mb-8 flex gap-3">
        <Input
          type="text"
          value={newAnimeTitle}
          onChange={(e) => setNewAnimeTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newAnimeTitle.trim() && addAnime()}
          placeholder="Add an anime title..."
          aria-label="Anime title"
          className="flex-1"
        />
        <Button variant="secondary" onClick={addAnime} disabled={!newAnimeTitle.trim()} className="whitespace-nowrap">
          + Add
        </Button>
        <Button variant="neutral" onClick={() => setImportMode('pick')} className="whitespace-nowrap">
          🔗 Import
        </Button>
        {/* Only once there is an account to refresh from. This is the screen
            dedicated to managing a list, so the one-tap path belongs here. */}
        {profile.anilistUsername && (
          <Button variant="neutral" onClick={() => setImportMode('refresh')} className="whitespace-nowrap">
            🔄 Refresh
          </Button>
        )}
      </div>

      {importMode && (
        <AniListImport
          profile={profile}
          autoRefresh={importMode === 'refresh'}
          onClose={() => setImportMode(null)}
          onImported={(mergedProfile) => {
            saveUpdatedProfile(mergedProfile);
            setImportMode(null);
          }}
        />
      )}

      {/* Anime List */}
      {profile.animeList.length === 0 ? (
        <div className="py-16 text-center text-white/30">
          <div className="mb-3 text-5xl">📺</div>
          <p className="text-lg">No anime yet — add one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.animeList.map((anime) => (
            <div key={anime.id} className="card-pop overflow-hidden">
              {/* Anime Header */}
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  onClick={() => setExpandedAnime(expandedAnime === anime.id ? null : anime.id)}
                  className="focus-pop flex-1 rounded-pop-sm text-left"
                >
                  <span className="font-display text-lg font-extrabold text-white">{anime.title}</span>
                  <span className="ml-2 text-sm text-white/40">
                    {anime.characters.length === 0 ? '⚠️ No characters' : `${anime.characters.length} character${anime.characters.length !== 1 ? 's' : ''}`}
                  </span>
                  <span className="ml-2 text-white/30">{expandedAnime === anime.id ? '▲' : '▼'}</span>
                </button>
                <div className="ml-4 flex gap-2">
                  <Button
                    variant="info"
                    size="sm"
                    onClick={() => { openAddCharacter(anime.id); setExpandedAnime(anime.id); }}
                  >
                    + Character
                  </Button>
                  <button
                    onClick={() => deleteAnime(anime.id)}
                    aria-label={`Delete ${anime.title}`}
                    className="focus-pop grid h-11 w-11 place-items-center rounded-pop-sm text-white/40 hover:text-pop-red"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Expanded: Characters + Form */}
              {expandedAnime === anime.id && (
                <div className="space-y-2 border-t border-white/10 px-5 py-4">
                  {anime.characters.length === 0 && !addingCharacterTo && (
                    <p className="py-2 text-center text-sm text-white/30">No characters yet</p>
                  )}

                  {anime.characters.map((char) => (
                    <div key={char.id} className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
                      <span className="text-white/80">{char.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditCharacter(anime.id, char)}
                          aria-label={`Edit ${char.name}`}
                          className="focus-pop grid h-11 w-11 place-items-center rounded-pop-sm text-white/60 hover:text-white"
                        >✏️</button>
                        <button
                          onClick={() => deleteCharacter(anime.id, char.id)}
                          aria-label={`Delete ${char.name}`}
                          className="focus-pop grid h-11 w-11 place-items-center rounded-pop-sm text-white/40 hover:text-pop-red"
                        >🗑️</button>
                      </div>
                    </div>
                  ))}

                  {/* Add / Edit Character Form */}
                  {addingCharacterTo === anime.id && (
                    <div className="mt-4 space-y-4 rounded-pop border-2 border-white/10 bg-surface-2 p-5">
                      <h4 className="font-display text-lg font-extrabold text-white">
                        {editingCharacter ? '✏️ Edit Character' : '➕ Add Character'}
                      </h4>

                      <Field label="Name *">
                        <Input value={characterForm.name} onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })} placeholder="Character name" />
                      </Field>

                      <Field label="Image URL (optional)">
                        <Input value={characterForm.imageUrl} onChange={(e) => setCharacterForm({ ...characterForm, imageUrl: e.target.value })} placeholder="https://..." />
                      </Field>

                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Gender *">
                          <Select value={characterForm.gender} onChange={(e) => setCharacterForm({ ...characterForm, gender: e.target.value })}>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </Select>
                        </Field>
                        <Field label="Role *">
                          <Select value={characterForm.role} onChange={(e) => setCharacterForm({ ...characterForm, role: e.target.value })}>
                            <option>Protagonist</option>
                            <option>Antagonist</option>
                            <option>Supporting</option>
                          </Select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Hair Color *">
                          <Input value={characterForm.hairColor} onChange={(e) => setCharacterForm({ ...characterForm, hairColor: e.target.value })} placeholder="e.g. Black" />
                        </Field>
                        <Field label="Genre *">
                          <Select value={characterForm.genre} onChange={(e) => setCharacterForm({ ...characterForm, genre: e.target.value })}>
                            <option>Action</option>
                            <option>Romance</option>
                            <option>Comedy</option>
                            <option>Isekai</option>
                            <option>Horror</option>
                            <option>Sci-Fi</option>
                            <option>Sports</option>
                            <option>Other</option>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Power / Ability *">
                        <Input value={characterForm.ability} onChange={(e) => setCharacterForm({ ...characterForm, ability: e.target.value })} placeholder="e.g. Stretches body like rubber" />
                      </Field>

                      <div className="flex gap-3 pt-1">
                        <Button
                          variant="neutral"
                          onClick={() => { setAddingCharacterTo(null); setEditingCharacter(null); }}
                        >Cancel</Button>
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={() => saveCharacter(anime.id)}
                          disabled={!isFormValid()}
                        >
                          {editingCharacter ? 'Save Changes' : 'Add Character'}
                        </Button>
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
