import { useState, useMemo } from 'react';
import { fetchUserAnimeList, fetchAnimeCharacters } from '../services/anilist';
import { filterAndMapCharacterEdges } from '../utils/anilistFormat';
import { mergeAnimeIntoProfile } from '../utils/profileMerge';
import { useEscapeKey } from '../hooks/useEscapeKey';

const MAX_CHARACTERS_PER_SHOW = 60;

export default function AniListImport({ profile, onClose, onImported }) {
  const [step, setStep] = useState('username'); // username | list | importing | done | error
  const [username, setUsername] = useState('');
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minSupportingFavourites, setMinSupportingFavourites] = useState(100);
  const [mainOnly, setMainOnly] = useState(false);

  const [animeOptions, setAnimeOptions] = useState([]); // { animeId, title, coverImageUrl, status }
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const [progress, setProgress] = useState({ index: 0, total: 0, title: '' });
  const [abortController, setAbortController] = useState(null);
  const [mergedProfile, setMergedProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEscapeKey(step !== 'importing', onClose);

  const fetchList = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setStep('loading-list');
    try {
      const statusIn = includeCurrent ? ['COMPLETED', 'CURRENT'] : ['COMPLETED'];
      const list = await fetchUserAnimeList(trimmed, { statusIn });
      if (list.length === 0) {
        setErrorMessage(`"${trimmed}" has no anime in the selected list status(es).`);
        setStep('error');
        return;
      }
      setAnimeOptions(list);
      setSelected(new Set(list.map((a) => a.id)));
      setStep('list');
    } catch (err) {
      setErrorMessage(err.message);
      setStep('error');
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return animeOptions;
    return animeOptions.filter((a) => a.title.toLowerCase().includes(q));
  }, [animeOptions, search]);

  const startImport = async () => {
    const toImport = animeOptions.filter((a) => selected.has(a.id));
    if (toImport.length === 0) return;

    const controller = new AbortController();
    setAbortController(controller);
    setStep('importing');
    setProgress({ index: 0, total: toImport.length, title: toImport[0].title });

    const importedAnimeList = [];
    try {
      for (let i = 0; i < toImport.length; i++) {
        const anime = toImport[i];
        setProgress({ index: i + 1, total: toImport.length, title: anime.title });
        const { genres, edges } = await fetchAnimeCharacters(anime.id, {
          signal: controller.signal,
          minSupportingFavourites,
          mainOnly,
        });
        const characters = filterAndMapCharacterEdges(edges, {
          minSupportingFavourites,
          mainOnly,
          maxCharacters: MAX_CHARACTERS_PER_SHOW,
          genres,
        });
        importedAnimeList.push({ animeId: anime.id, title: anime.title, characters });
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Cancelled — discard partial results, return to the checklist.
        setStep('list');
        setAbortController(null);
        return;
      }
      setErrorMessage(err.message);
      setStep('error');
      setAbortController(null);
      return;
    }

    const { profile: merged, addedAnime, addedChars } = mergeAnimeIntoProfile(profile, importedAnimeList);
    setMergedProfile(merged);
    setStats({ addedAnime, addedChars });
    setStep('done');
    setAbortController(null);
  };

  const finishImport = () => {
    onImported(mergedProfile, stats);
  };

  const cancelImport = () => {
    abortController?.abort();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true">
      <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-lg w-full max-h-[36rem] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white">🔗 Import from AniList</h2>
          {step !== 'importing' && (
            <button onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white text-xl">✕</button>
          )}
        </div>

        {(step === 'username' || step === 'loading-list') && (
          <div>
            <label className="block text-white/60 text-sm font-semibold mb-1">AniList Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && username.trim() && fetchList()}
              placeholder="e.g. YourAniListName"
              autoFocus
              disabled={step === 'loading-list'}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 outline-none focus:border-purple-500 mb-4"
            />
            <label className="flex items-center gap-3 text-white/70 mb-4 cursor-pointer">
              <input type="checkbox" checked={includeCurrent} onChange={(e) => setIncludeCurrent(e.target.checked)} className="w-5 h-5" />
              Also include shows I'm currently watching
            </label>

            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-white/40 hover:text-white text-sm mb-3"
            >
              {showAdvanced ? '▼' : '▶'} Advanced
            </button>
            {showAdvanced && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
                <label className="flex items-center gap-3 text-white/70 cursor-pointer">
                  <input type="checkbox" checked={mainOnly} onChange={(e) => setMainOnly(e.target.checked)} className="w-5 h-5" />
                  Main characters only
                </label>
                {!mainOnly && (
                  <div className="flex items-center gap-3 text-white/70">
                    <span>Min. favourites for supporting characters:</span>
                    <input
                      type="number"
                      min={0}
                      value={minSupportingFavourites}
                      onChange={(e) => setMinSupportingFavourites(parseInt(e.target.value) || 0)}
                      className="w-24 bg-white/10 border border-white/20 rounded-lg px-2 py-2 text-white text-center"
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={fetchList}
              disabled={!username.trim() || step === 'loading-list'}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all"
            >
              {step === 'loading-list' ? 'Fetching your list…' : 'Fetch My List'}
            </button>
          </div>
        )}

        {step === 'list' && (
          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter…"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder-white/40 outline-none focus:border-purple-500 mb-3"
            />
            <div className="flex gap-3 mb-3">
              <button onClick={() => setSelected(new Set(animeOptions.map((a) => a.id)))} className="text-sm text-white/60 hover:text-white">Select All</button>
              <button onClick={() => setSelected(new Set())} className="text-sm text-white/60 hover:text-white">Select None</button>
              <span className="ml-auto text-white/40 text-sm">{selected.size} selected</span>
            </div>
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {filteredOptions.map((anime) => (
                <label key={anime.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3 cursor-pointer">
                  <input type="checkbox" checked={selected.has(anime.id)} onChange={() => toggleSelected(anime.id)} className="w-5 h-5 flex-shrink-0" />
                  {anime.coverImageUrl ? (
                    <img src={anime.coverImageUrl} alt="" loading="lazy" className="w-10 h-14 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 rounded bg-white/10 flex-shrink-0" />
                  )}
                  <span className="text-white text-sm">{anime.title}</span>
                </label>
              ))}
            </div>
            <button
              onClick={startImport}
              disabled={selected.size === 0}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all"
            >
              Import Selected ({selected.size})
            </button>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">📥</div>
            <p className="text-white font-bold text-lg mb-1">
              Importing {progress.index} of {progress.total}
            </p>
            <p className="text-white/50 mb-6 truncate">{progress.title}</p>
            <div className="w-full bg-white/10 rounded-full h-3 mb-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all"
                style={{ width: `${(progress.index / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <button onClick={cancelImport} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-white font-bold text-lg mb-2">Import complete!</p>
            <p className="text-white/60 mb-6">
              +{stats?.addedAnime ?? 0} anime, +{stats?.addedChars ?? 0} characters
            </p>
            <button onClick={finishImport} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl transition-all">
              Done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-6">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-red-400 font-bold mb-6">{errorMessage}</p>
            <button onClick={() => setStep('username')} className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
