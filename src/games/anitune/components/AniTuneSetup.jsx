import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import { getEligibleAnimeList } from '../utils/questionPool';
import { RACE, SIMULTANEOUS } from '../rules';

const MODES = [
  { id: RACE, icon: '🔔', label: 'Race', blurb: 'First correct answer takes the point. Miss and you’re out for that song.' },
  { id: SIMULTANEOUS, icon: '🤫', label: 'Everyone guesses', blurb: 'Pass the device round. Everyone who gets it right scores.' },
];

export default function AniTuneSetup({ onStart, onExit, preparing, progress, error }) {
  const { loadOrCreateProfile } = useProfile();
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [mode, setMode] = useState(RACE);
  const [sharedSongsOnly, setSharedSongsOnly] = useState(true);
  const [includeOpenings, setIncludeOpenings] = useState(true);
  const [includeEndings, setIncludeEndings] = useState(true);
  const [roundSize, setRoundSize] = useState(10);
  const [clipSeconds, setClipSeconds] = useState(10);

  const addPlayer = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { profile } = loadOrCreateProfile(trimmed);
    if (players.some((p) => p.id === profile.id)) {
      setNameInput('');
      return;
    }
    setPlayers([...players, profile]);
    setNameInput('');
  };

  const eligible = getEligibleAnimeList(players, { sharedSongsOnly });
  const everyoneHasShows = players.every((p) => (p.animeList || []).length > 0);
  const canStart =
    players.length >= 1 &&
    everyoneHasShows &&
    eligible.length > 0 &&
    (includeOpenings || includeEndings) &&
    !preparing;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-1 text-center">
          🎵 AniTune
        </h1>
        <p className="text-white/60 text-center mb-8">Name the anime from its opening or ending</p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Enter player name…"
            disabled={preparing}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-5 py-3 text-white placeholder-white/40 outline-none focus:border-pink-500"
          />
          <button
            onClick={addPlayer}
            disabled={!nameInput.trim() || preparing}
            className="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white font-bold rounded-xl transition-colors"
          >
            Add
          </button>
        </div>

        {players.length === 0 && (
          <p className="text-white/40 text-center text-sm mb-6">
            Add at least one player. Profiles and anime lists are shared with AniGuess.
          </p>
        )}

        {players.length > 0 && (
          <div className="bg-white/5 rounded-xl overflow-hidden mb-6">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                <span className="text-white font-bold flex-1">{p.name}</span>
                <span className={(p.animeList || []).length ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                  {(p.animeList || []).length} shows
                </span>
                <button
                  onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                  disabled={preparing}
                  className="text-red-400 hover:text-red-300 disabled:opacity-30 px-1"
                  aria-label={`Remove ${p.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              disabled={preparing}
              className={`text-left p-4 rounded-xl border transition-colors disabled:opacity-40 ${
                mode === m.id
                  ? 'bg-purple-600/20 border-purple-500'
                  : 'bg-white/5 border-white/10 hover:border-white/25'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <p className="text-white font-bold mt-1">{m.label}</p>
              <p className="text-white/40 text-xs mt-1">{m.blurb}</p>
            </button>
          ))}
        </div>

        <div className="bg-white/5 rounded-xl p-5 mb-6">
          <h2 className="text-white font-bold text-lg mb-4">⚙️ Settings</h2>

          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sharedSongsOnly}
              onChange={(e) => setSharedSongsOnly(e.target.checked)}
              disabled={preparing}
              className="w-5 h-5"
            />
            <span className="text-white">Shared songs only</span>
          </label>
          <p className="text-white/40 text-sm mb-4 ml-8">
            Only use shows <em>everyone</em> has on their list, so nobody is guessing blind.
          </p>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeOpenings} disabled={preparing}
                onChange={(e) => setIncludeOpenings(e.target.checked)} className="w-5 h-5" />
              <span className="text-white">Openings</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeEndings} disabled={preparing}
                onChange={(e) => setIncludeEndings(e.target.checked)} className="w-5 h-5" />
              <span className="text-white">Endings</span>
            </label>
          </div>

          <div className="flex gap-4">
            <label className="flex-1">
              <span className="text-white/60 text-sm block mb-1">Questions</span>
              <input type="number" min="1" max="50" value={roundSize} disabled={preparing}
                onChange={(e) => setRoundSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-pink-500" />
            </label>
            <label className="flex-1">
              <span className="text-white/60 text-sm block mb-1">Clip length (s)</span>
              <input type="number" min="3" max="30" value={clipSeconds} disabled={preparing}
                onChange={(e) => setClipSeconds(Math.max(3, parseInt(e.target.value) || 3))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-pink-500" />
            </label>
          </div>
        </div>

        {players.length > 0 && (
          <p className="text-white/50 text-center text-sm mb-4">
            {eligible.length} show{eligible.length === 1 ? '' : 's'} in play
            {sharedSongsOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {players.length > 1 && sharedSongsOnly && eligible.length === 0 && (
          <p className="text-yellow-400 text-center text-sm mb-4">
            No shows in common — turn off &ldquo;Shared songs only&rdquo; or import more lists.
          </p>
        )}

        {!everyoneHasShows && players.length > 0 && (
          <p className="text-yellow-400 text-center text-sm mb-4">
            Everyone needs an anime list. Add one in AniGuess first.
          </p>
        )}

        {error && <p className="text-red-400 text-center text-sm mb-4">{error}</p>}

        {preparing && progress && (
          <div className="mb-4">
            <p className="text-white/60 text-center text-sm mb-2">
              {progress.phase === 'resolving' ? 'Matching your shows…' : 'Loading themes…'} {progress.done}/{progress.total}
            </p>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 transition-[width]"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
            <p className="text-white/30 text-center text-xs mt-2">
              First time takes a moment; after that it&apos;s cached.
            </p>
          </div>
        )}

        <button
          onClick={() => onStart({
            players, mode, sharedSongsOnly, includeOpenings, includeEndings, roundSize, clipSeconds,
          })}
          disabled={!canStart}
          className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xl rounded-xl transition-all"
        >
          {preparing ? 'Preparing…' : '🎮 Start Game'}
        </button>

        <button onClick={onExit} disabled={preparing}
          className="w-full mt-3 text-white/60 hover:text-white disabled:opacity-30 transition-colors">
          ← Back to hub
        </button>
      </div>
    </div>
  );
}
