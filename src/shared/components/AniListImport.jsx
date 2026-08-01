import { useState, useMemo, useEffect, useRef } from 'react';
import { fetchUserAnimeList, fetchManyAnimeCharacters } from '../services/anilist';
import { filterAndMapCharacterEdges, mergeCharacterEdges } from '../utils/anilistFormat';
import { groupIntoFranchises } from '../utils/franchise';
import {
  mergeAnimeIntoProfile,
  classifyImportGroups,
  mergeImportedAnilistIds,
} from '../utils/profileMerge';
import { Badge, Button, Card, Checkbox, Input, Label, Modal } from '../ui';

const MAX_CHARACTERS_PER_SHOW = 60;

export default function AniListImport({ profile, onClose, onImported, autoRefresh = false }) {
  const [step, setStep] = useState('username'); // username | list | importing | done | error
  // Prefilled from the profile so a re-import is one tap. Re-importing is the
  // common case, not the rare one: the page cache in anilist.js is in-memory
  // only, so every refresh means paying the full ~2.2s-per-request throttle
  // again, and nobody wants to also retype their username to do it.
  const [username, setUsername] = useState(profile?.anilistUsername ?? '');
  // Remembered from the last successful import, so a one-tap refresh applies the
  // same filters the existing list was built with rather than silently reverting
  // to the defaults and pulling in characters the user had filtered out.
  const savedSettings = profile?.anilistImportSettings;
  const [includeCurrent, setIncludeCurrent] = useState(savedSettings?.includeCurrent ?? false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minSupportingFavourites, setMinSupportingFavourites] = useState(
    savedSettings?.minSupportingFavourites ?? 100
  );
  const [mainOnly, setMainOnly] = useState(savedSettings?.mainOnly ?? false);

  // One row per show, not per season: each option is a franchise group
  // { key, title, coverImageUrl, memberIds, members }. `selected` holds keys.
  const [animeOptions, setAnimeOptions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [hideImported, setHideImported] = useState(false);

  // What a re-import would actually buy: which groups are new, which gained a
  // season, and which are already paid for. Memoized because it is O(groups ×
  // animeList) with a regex in the inner loop — fine once per fetch, wasteful
  // on every keystroke in the filter box.
  const { byKey: importStates, counts, suggested } = useMemo(
    () => classifyImportGroups(profile, animeOptions),
    [profile, animeOptions]
  );
  // A first-ever import has nothing to compare against, so the whole feature
  // stays invisible: no summary, no badges, no toggle, everything preselected —
  // exactly the screen that shipped before this existed.
  const isFirstImport = counts.known === 0;

  // Only offer the skip-the-checklist button while the field still names the
  // account this profile was built from — typing someone else's name is not a
  // refresh, and should land on the checklist like any first import.
  const canRefresh = Boolean(profile?.anilistUsername)
    && username.trim().toLowerCase() === profile.anilistUsername.toLowerCase();

  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [abortController, setAbortController] = useState(null);
  const [mergedProfile, setMergedProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // `auto` is the one-tap refresh path: fetch the list and go straight into
  // importing whatever is new, without stopping at the checklist.
  const fetchList = async ({ auto = false } = {}) => {
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
      // Preselect only what costs something: shows not in the profile, plus
      // franchises that gained a season. Selecting all 200 shows to discover
      // three new ones is ~14 throttled round-trips against AniList's real
      // ~30 req/min limit, every time. Select All is still one tap away.
      const { suggested: toImport } = classifyImportGroups(profile, groups);
      setAnimeOptions(groups);
      setSelected(toImport);
      // Default the toggle on only when there is something left to look at —
      // hiding every row would leave an empty list.
      setHideImported(toImport.size > 0 && toImport.size < groups.length);

      if (auto && toImport.size > 0) {
        runImport(groups.filter((g) => toImport.has(g.key)));
        return;
      }
      // Nothing new on the auto path lands here too: the checklist's up-to-date
      // card explains why, and keeps Select All reachable.
      setStep('list');
    } catch (err) {
      setErrorMessage(err.message);
      setStep('error');
    }
  };

  // Fires once, only when a caller explicitly asked for the one-tap path and the
  // profile actually has a username to refresh from; otherwise the dialog opens
  // on the normal username step.
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (!autoRefresh || autoRunRef.current || !profile?.anilistUsername) return;
    autoRunRef.current = true;
    fetchList({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, profile?.anilistUsername]);

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

  const visibleOptions = useMemo(
    () => (hideImported
      ? filteredOptions.filter((g) => importStates.get(g.key) !== 'known')
      : filteredOptions),
    [filteredOptions, hideImported, importStates]
  );

  const startImport = () => runImport(animeOptions.filter((g) => selected.has(g.key)));

  async function runImport(selectedGroups) {
    if (selectedGroups.length === 0) return;

    // Characters are still fetched per AniList media id — the progress bar
    // counts those fetches, so its total is the flattened member count.
    //
    // Every member of a selected group is fetched, including ones already
    // covered: filterAndMapCharacterEdges applies the favourites filter and the
    // per-show cap across the WHOLE franchise cast below, so a group that only
    // gained a season still needs its earlier seasons' edges to filter against.
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
    // All three are remembered only on a successful import, so a typo'd username
    // never sticks, and a cancelled run never claims coverage it doesn't have.
    setMergedProfile({
      ...merged,
      anilistUsername: username.trim(),
      // Recorded rather than inferred: mergeAnimeIntoProfile collapses a
      // franchise's seasons into ONE entry, so the surviving entry id cannot say
      // which seasons were fetched — and that is exactly what the next import's
      // checklist has to answer to spot a newly aired season.
      anilistImportedIds: mergeImportedAnilistIds(profile?.anilistImportedIds, memberIds),
      anilistImportSettings: { includeCurrent, mainOnly, minSupportingFavourites },
    });
    setStats({ addedAnime, addedChars });
    setStep('done');
    setAbortController(null);
  }

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
            onClick={() => fetchList({ auto: canRefresh })}
            disabled={!username.trim() || step === 'loading-list'}
          >
            {step === 'loading-list'
              ? 'Fetching your list…'
              : canRefresh ? '🔄 Refresh my list' : 'Fetch My List'}
          </Button>
          {/* The checklist is still one tap away — needed to re-fetch a show
              whose cast has grown, or to import with different settings. */}
          {canRefresh && step !== 'loading-list' && (
            <button
              onClick={() => fetchList()}
              className="focus-pop mt-3 w-full rounded-pop-sm text-sm text-white/40 hover:text-white"
            >
              or choose what to import…
            </button>
          )}
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
          {!isFirstImport && suggested.size === 0 && (
            <Card padding="sm" className="mb-3 text-center">
              <p className="font-display font-extrabold text-white">✅ You&rsquo;re up to date</p>
              <p className="mt-1 text-sm text-white/50">
                All {counts.known} shows on your AniList are already in your list. Use{' '}
                <strong className="text-white/70">Select All</strong> to re-fetch them anyway —
                handy if a show has gained characters, or you changed the Advanced settings.
              </p>
            </Card>
          )}

          <div className="mb-1 flex items-center gap-3">
            {!isFirstImport && (
              <button
                onClick={() => setSelected(new Set(suggested))}
                className="focus-pop rounded-pop-sm text-sm text-white/60 hover:text-white"
              >
                Select New
              </button>
            )}
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

          {/* Only once there is a re-import to describe. On a first import
              "0 already imported" is noise at best and alarming at worst. */}
          {!isFirstImport && (
            <p className="mb-2 text-xs text-white/40">
              {counts.new} new
              {counts.partial > 0 && ` · ${counts.partial} with a new season`}
              {` · ${counts.known} already imported`}
            </p>
          )}

          {!isFirstImport && (
            <Checkbox
              label="Hide already imported"
              checked={hideImported}
              onChange={(e) => setHideImported(e.target.checked)}
              className="mb-3"
            />
          )}

          <div className="mb-4 max-h-72 space-y-2 overflow-y-auto">
            {visibleOptions.map((group) => {
              const state = importStates.get(group.key) ?? 'new';
              return (
                <label
                  key={group.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-pop-sm border-2
                    border-white/10 bg-surface-2 p-3 ${state === 'known' ? 'opacity-50' : ''}`}
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
                  {/* Only 'partial' earns a badge. 'new' is already the checked
                      majority and 'known' is dimmed and unchecked, so badging
                      either would be 200 rows of decoration; a newly aired
                      season is the one state a user must not miss. */}
                  {state === 'partial' && <Badge tone="amber">New season</Badge>}
                  {state === 'known' && (
                    <span className="flex-shrink-0 text-xs text-white/40">Imported</span>
                  )}
                  {group.memberIds.length > 1 && (
                    <span className="flex-shrink-0 text-xs text-white/40">{group.memberIds.length} entries</span>
                  )}
                </label>
              );
            })}
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
