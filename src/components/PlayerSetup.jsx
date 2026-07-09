import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useWins } from '../hooks/useWins';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { normalizeTitle } from '../utils/ranking';
import AniListImport from './AniListImport';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePlayer({ player, onRemove, onGoToList }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const totalCharacters = player.animeList.reduce(
    (sum, anime) => sum + anime.characters.length, 0
  );

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 bg-white/10 rounded-xl p-4 mb-3 border border-white/20">
      <span {...attributes} {...listeners} className="cursor-grab text-white/40 text-2xl">☰</span>
      <span className="flex-1 font-bold text-white text-lg">{player.name}</span>
      {totalCharacters === 0 && (
        <span className="text-yellow-400 text-sm">⚠️ No chars</span>
      )}
      {totalCharacters > 0 && (
        <span className="text-green-400 text-base">{totalCharacters} chars</span>
      )}
      <button
        onClick={() => onGoToList(player)}
        className="px-3 py-1 bg-white/10 hover:bg-purple-600/50 text-white/60 hover:text-white text-sm rounded-lg transition-colors"
      >✏️ Edit List</button>
      <button onClick={() => onRemove(player.id)} aria-label={`Remove ${player.name}`} className="text-red-400 hover:text-red-300 font-bold text-lg">✕</button>
    </div>
  );
}

export default function PlayerSetup({ onStartGame, onGoToList, players, onPlayersChange }) {
  const { loadOrCreateProfile, saveProfile } = useProfile();
  const { getWins, resetWins } = useWins();
  const [nameInput, setNameInput] = useState('');
  const [importTarget, setImportTarget] = useState(null);
  const [showWins, setShowWins] = useState(false);
  const [twoStepRandom, setTwoStepRandom] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [sharedShowsOnly, setSharedShowsOnly] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [pointsPerPosition, setPointsPerPosition] = useState([3, 2, 1, 0]);

  const sensors = useSensors(useSensor(PointerSensor));

  const addPlayer = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { profile } = loadOrCreateProfile(trimmed);
    if (players.some((p) => p.id === profile.id)) {
      alert(`${profile.name} is already in the game!`);
      setNameInput('');
      return;
    }
    onPlayersChange([...players, profile]);
    setNameInput('');
  };

  const removePlayer = (id) => onPlayersChange(players.filter((p) => p.id !== id));

  const startImport = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      alert('Enter a player name first, then Import.');
      return;
    }
    const { profile } = loadOrCreateProfile(trimmed);
    if (players.some((p) => p.id === profile.id)) {
      alert(`${profile.name} is already in the game!`);
      return;
    }
    setImportTarget(profile);
  };

  const handleImported = (mergedProfile) => {
    saveProfile(mergedProfile);
    onPlayersChange([...players, mergedProfile]);
    setNameInput('');
    setImportTarget(null);
  };

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      onPlayersChange(arrayMove(players, oldIndex, newIndex));
    }
  };

  const updatePoints = (i, val) => {
    const updated = [...pointsPerPosition];
    updated[i] = parseInt(val) || 0;
    setPointsPerPosition(updated);
  };

  const allHaveChars = players.every(
    (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0) > 0
  );
  const hasSharedAnime = players.length < 2 || players.some((p, i) =>
    players.some((other, j) => i !== j &&
      p.animeList.some(a => other.animeList.some(o => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = players.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  const winsEntries = showWins ? Object.entries(getWins()).sort((a, b) => b[1] - a[1]) : [];

  const handleResetWins = () => {
    if (window.confirm('Reset all-time wins? This cannot be undone.')) {
      resetWins();
      setShowWins(false);
    }
  };

  useEscapeKey(showWins, () => setShowWins(false));

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-3">
          AniGuess
        </h1>
        <p className="text-white/60 text-lg">The anime character guessing game</p>
        <button onClick={() => setShowWins(true)} className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm rounded-xl transition-colors">
          🏅 All-Time Leaderboard
        </button>
      </div>

      {showWins && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setShowWins(false)} role="dialog" aria-modal="true">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-3xl font-black text-white mb-6">🏅 All-Time Wins</h2>
            {winsEntries.length === 0
              ? <p className="text-white/40 text-center py-4">No games played yet!</p>
              : winsEntries.map(([name, count], i) => (
                <div key={name} className="flex justify-between items-center py-3 border-b border-white/10 last:border-0">
                  <span className="text-white text-lg">{i === 0 ? '👑 ' : ''}{name}</span>
                  <span className="text-yellow-400 font-black text-xl">{count} W</span>
                </div>
              ))
            }
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowWins(false)} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">Close</button>
              {winsEntries.length > 0 && <button onClick={handleResetWins} className="flex-1 py-3 bg-red-600/40 hover:bg-red-600/70 text-red-300 font-bold rounded-xl transition-colors">Reset</button>}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl">
        {/* Add Player */}
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && addPlayer()}
            placeholder="Enter player name..."
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-5 py-4 text-white text-lg placeholder-white/40 outline-none focus:border-purple-500"
          />
          <button
            onClick={addPlayer}
            disabled={!nameInput.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold px-6 py-4 text-lg rounded-xl transition-colors"
          >
            Add
          </button>
          <button
            onClick={startImport}
            disabled={!nameInput.trim()}
            className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/20 text-white font-bold px-5 py-4 text-lg rounded-xl transition-colors whitespace-nowrap"
          >
            🔗 Import
          </button>
        </div>

        {importTarget && (
          <AniListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        {/* Player List */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {players.map((p) => (
              <SortablePlayer key={p.id} player={p} onRemove={removePlayer} onGoToList={onGoToList} />
            ))}
          </SortableContext>
        </DndContext>

        {players.length < 2 && (
          <p className="text-white/40 text-center text-base mb-5">Add at least 2 players to start</p>
        )}
        {players.length >= 2 && sharedShowsOnly && !hasSharedAnime && (
          <p className="text-yellow-400 text-center text-base mb-5">
            ⚠️ No anime titles are shared between all players — uncheck "Shared shows only" or add matching titles.
          </p>
        )}

        {/* Settings */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 mt-4">
          <h3 className="text-white font-bold text-xl mb-4">⚙️ Settings</h3>

          <label className="flex items-center gap-3 text-white/80 text-lg mb-4 cursor-pointer">
            <input type="checkbox" checked={twoStepRandom} onChange={(e) => setTwoStepRandom(e.target.checked)} className="w-5 h-5" />
            Anime-first randomizer
          </label>

          <label className="flex items-center gap-3 text-white/80 text-lg mb-4 cursor-pointer">
            <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} className="w-5 h-5" />
            Enable Timer
          </label>

          <label className="flex items-center gap-3 text-white/80 text-lg mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={sharedShowsOnly}
              onChange={(e) => setSharedShowsOnly(e.target.checked)}
              className="w-5 h-5"
            />
            Shared shows only
          </label>

          {timerEnabled && (
            <div className="flex items-center gap-3 mb-4 text-white/70 text-lg">
              <span>Seconds:</span>
              <input
                type="number"
                value={timerSeconds}
                min={30} max={300}
                onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 60)}
                className="w-20 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-center text-lg"
              />
            </div>
          )}

          <div>
            <p className="text-white/70 text-base mb-3">Points per position:</p>
            <div className="flex gap-4">
              {['🥇', '🥈', '🥉', 'Rest'].map((label, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="text-lg">{label}</span>
                  <input
                    type="number"
                    value={pointsPerPosition[i]}
                    min={0}
                    onChange={(e) => updatePoints(i, e.target.value)}
                    className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-center text-lg"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => onStartGame({ players, settings: { timerEnabled, timerSeconds, pointsPerPosition, sharedShowsOnly, twoStepRandom } })}
          disabled={!canStart}
          className="w-full py-5 rounded-xl font-black text-2xl transition-all duration-200 
            disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed
            bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-purple-900/50"
        >
          🎮 Start Game
        </button>
      </div>
    </div>
  );
}
