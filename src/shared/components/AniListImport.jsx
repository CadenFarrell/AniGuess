import { useState, useMemo } from 'react';
import { fetchUserAnimeList, fetchManyAnimeCharacters } from '../services/anilist';
import { filterAndMapCharacterEdges, mergeCharacterEdges } from '../utils/anilistFormat';
import { groupIntoFranchises } from '../utils/franchise';
import { mergeAnimeIntoProfile } from '../utils/profileMerge';
import { Button, Card, Checkbox, Input, Label, Modal } from '../ui';

const MAX_CHARACTERS_PER_SHOW = 60;

export default function AniListImport({ profile, onClose, onImported }) {
  const [step, setStep] = useState('username'); // username | list | importing | done | error
  const [username, setUsername] = useState('');
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minSupportingFavourites, setMinSupportingFavourites] = useState(100);
  const [mainOnly, setMainOnly] = useState(false);

  // One row per show, not per season: each option is a franchise group
  // { key, title, coverImageUrl, memberIds, members }. `selected` holds keys.
  const [animeOptions, setAnimeOptions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [abortController, setAbortController] = useState(null);
  const [mergedProfile, setMergedProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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
      const groups = groupIntoFranchises(list);
      setAnimeOptions(groups);
      setSelected(new Set(groups.map((g) => g.key)));
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
    // Match the shown title or any season's title, so typing "Season 2" still
    // finds the group it was folded into.
    return animeOptions.filter((g) =>
      g.title.toLowerCase().includes(q) ||
      g.members.some((m) => m.title.toLowerCase().includes(q))
    );
  }, [animeOptions, search]);

  const startImport = async () => {
    const selectedGroups = animeOptions.filter((g) => selected.has(g.key));
    if (selectedGroups.length === 0) return;

    // Characters are still fetched per AniList media id — the progress bar
    // counts those fetches, so its total is the flattened member count.
    const memberIds = selectedGroups.flatMap((g) => g.memberIds);

    const controller = new AbortController();
    setAbortController(controller);
    setStep('importing');
    setProgress({ index: 0, total: memberIds.length });

    let charactersById;
    try {
      charactersById = await fetchManyAnimeCharacters(memberIds, {
        signal: controller.signal,
        minSupportingFavourites,
        mainOnly,
        onProgress: (resolved) => setProgress({ index: resolved, total: memberIds.length }),
      });
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

    const importedAnimeList = selectedGroups.map((group) => {
      const memberResults = group.memberIds.map((id) => charactersById.get(id) ?? { genres: [], edges: [] });
      // Merge every season's cast, then apply the favourites/main filters and
      // the per-show cap once across the whole franchise.
      const edges = mergeCharacterEdges(memberResults.map((r) => r.edges));
      const genres = [...new Set(memberResults.flatMap((r) => r.genres))];
      const characters = filterAndMapCharacterEdges(edges, {
        minSupportingFavourites,
        mainOnly,
        maxCharacters: MAX_CHARACTERS_PER_SHOW,
        genres,
      });
      return { animeId: group.key, memberIds: group.memberIds, title: group.title, characters };
    });

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

  const pct = `${(progress.index / Math.max(progress.total, 1)) * 100}%`;

  return (
    // The import is cancellable but not dismissable mid-flight — closing the
    // dialog would strand the in-progress fetch, so lock it during 'importing'.
    <Modal onClose={onClose} dismissible={step !== 'importing'}>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold text-white">🔗 Import from AniList</h2>
        {step !== 'importing' && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-pop -mr-2 grid h-11 w-11 place-items-center rounded-pop-sm text-xl font-black text-white/40 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {(step === 'username' || step === 'loading-list') && (
        <div>
          <Label htmlFor="anilist-username">AniList Username</Label>
          <Input
            id="anilist-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && username.trim() && fetchList()}
            placeholder="e.g. YourAniListName"
            autoFocus
            disabled={step === 'loading-list'}
            className="mb-4"
          />
          <Checkbox
            label="Also include shows I'm currently watching"
            checked={includeCurrent}
            onChange={(e) => setIncludeCurrent(e.target.checked)}
            className="mb-4"
          />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="focus-pop mb-3 rounded-pop-sm text-sm text-white/40 hover:text-white"
          >
            {showAdvanced ? '▼' : '▶'} Advanced
          </button>
          {showAdvanced && (
            <Card padding="sm" className="mb-4 space-y-3">
              <Checkbox
                label="Main characters only"
                checked={mainOnly}
                onChange={(e) => setMainOnly(e.target.checked)}
              />
              {!mainOnly && (
                <div className="flex items-center gap-3 text-white/70">
                  <span>Min. favourites for supporting characters:</span>
                  <Input
                    type="number"
                    min={0}
                    value={minSupportingFavourites}
                    aria-label="Minimum favourites"
                    onChange={(e) => setMinSupportingFavourites(parseInt(e.target.value) || 0)}
                    className="w-24 px-2 text-center"
                  />
                </div>
              )}
            </Card>
          )}

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={fetchList}
            disabled={!username.trim() || step === 'loading-list'}
          >
            {step === 'loading-list' ? 'Fetching your list…' : 'Fetch My List'}
          </Button>
        </div>
      )}

      {step === 'list' && (
        <div>
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter…"
            aria-label="Filter anime"
            className="mb-3"
          />
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set(animeOptions.map((g) => g.key)))}
              className="focus-pop rounded-pop-sm text-sm text-white/60 hover:text-white"
            >
              Select All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="focus-pop rounded-pop-sm text-sm text-white/60 hover:text-white"
            >
              Select None
            </button>
            <span className="ml-auto text-sm text-white/40">{selected.size} selected</span>
          </div>
          <div className="mb-4 max-h-72 space-y-2 overflow-y-auto">
            {filteredOptions.map((group) => (
              <label
                key={group.key}
                className="flex cursor-pointer items-center gap-3 rounded-pop-sm border-2 border-white/10 bg-surface-2 p-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(group.key)}
                  onChange={() => toggleSelected(group.key)}
                  className="h-5 w-5 flex-shrink-0 accent-pop-lime"
                />
                {group.coverImageUrl ? (
                  <img src={group.coverImageUrl} alt="" loading="lazy" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-10 flex-shrink-0 rounded bg-white/10" />
                )}
                <span className="min-w-0 flex-1 text-sm text-white">{group.title}</span>
                {group.memberIds.length > 1 && (
                  <span className="flex-shrink-0 text-xs text-white/40">{group.memberIds.length} entries</span>
                )}
              </label>
            ))}
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={startImport}
            disabled={selected.size === 0}
          >
            Import Selected ({selected.size})
          </Button>
        </div>
      )}

      {step === 'importing' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">📥</div>
          <p className="mb-1 font-display text-lg font-extrabold text-white">Importing characters…</p>
          <p className="mb-6 text-white/50">{progress.index} of {progress.total} shows</p>
          <div className="mb-6 h-3 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2">
            <div className="h-full bg-pop-pink transition-all" style={{ width: pct }} />
          </div>
          <Button variant="neutral" onClick={cancelImport}>Cancel</Button>
        </div>
      )}

      {step === 'done' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">✅</div>
          <p className="mb-2 font-display text-lg font-extrabold text-white">Import complete!</p>
          <p className="mb-6 text-white/60">
            +{stats?.addedAnime ?? 0} anime, +{stats?.addedChars ?? 0} characters
          </p>
          <Button variant="success" size="lg" fullWidth onClick={finishImport}>Done</Button>
        </div>
      )}

      {step === 'error' && (
        <div className="py-6 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <p className="mb-6 font-display font-extrabold text-pop-red">{errorMessage}</p>
          <Button variant="neutral" size="lg" fullWidth onClick={() => setStep('username')}>Try Again</Button>
        </div>
      )}
    </Modal>
  );
}
