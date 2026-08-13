import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import AniTuneSettings from './AniTuneSettings';
import { eligibleCount } from '../utils/questionPool';
import { DEFAULT_PREFS } from '../prefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

export default function AniTuneSetup({ onStart, preparing, progress, error, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  // Your main profile is already seated; the picker adds the rest of the couch.
  const [players, setPlayers] = useState(() => activeProfile ? [activeProfile] : []);
  const [showPicker, setShowPicker] = useState(false);
  // Which player's list we're importing into. Until now this screen had no
  // import path at all — it told you to go and do it in AniGuess, which is a
  // dead end for anyone who only wants to play AniTune.
  const [importTarget, setImportTarget] = useState(null);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  //
  // One object rather than a useState per key. At six settings the split was
  // fine; at seventeen it is a list nobody keeps in sync with the lobby's copy,
  // which is exactly the drift AniTuneSettings was extracted to stop.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitune', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  // Persist to the shared profile store *and* to this screen's roster, so the
  // "N shows in play" line and the Start gate update without a remount.
  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const eligible = eligibleCount(players, settings);
  const everyoneHasShows = players.every((p) => (p.animeList || []).length > 0);
  const canStart =
    players.length >= 1 &&
    everyoneHasShows &&
    eligible > 0 &&
    (settings.includeOpenings || settings.includeEndings) &&
    !preparing;

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        <Wordmark
          tone="blue"
          subtitle="Name the anime from its opening or ending"
          className="mb-10"
        >
          AniTune
        </Wordmark>

        {/* Add Player. Same picker AniGuess uses — a saved profile, not a
            retyped name, so nobody gets seated as a fresh empty duplicate. */}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-5"
          disabled={preparing}
          onClick={() => setShowPicker(true)}
        >
          ➕ Add player
        </Button>

        {showPicker && (
          <ProfilePicker
            mode="add"
            excludeIds={players.map((p) => p.id)}
            onPick={(profile) => setPlayers((prev) => [...prev, profile])}
            onClose={() => setShowPicker(false)}
          />
        )}

        {players.length === 0 && (
          <p className="mb-6 text-center text-base text-white/40">
            Nobody seated yet — set your main profile with the 👤 button at the hub,
            or add a player above. Profiles and anime lists are shared with AniGuess.
          </p>
        )}

        {players.length > 0 && (
          <Card padding="sm" className="mb-6">
            {players.map((p) => {
              const shows = (p.animeList || []).length;
              return (
                <CardRow key={p.id}>
                  <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                    {p.name}
                  </span>
                  {p.id === activeId && <Badge tone="purple">You</Badge>}
                  <Badge tone={shows ? 'lime' : 'amber'}>
                    {shows ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                  <Button
                    variant="neutral"
                    size="sm"
                    className="flex-shrink-0"
                    aria-label={`Import ${p.name}'s list from AniList`}
                    disabled={preparing}
                    onClick={() => setImportTarget(p)}
                  >
                    🔗
                  </Button>
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    disabled={preparing}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white disabled:opacity-30"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

        <AniTuneSettings
          players={players}
          values={settings}
          disabled={preparing}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        />

        <div className="mb-6">
          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </div>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} show{eligible === 1 ? '' : 's'} in play
            {settings.sharedSongsOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {players.length > 1 && settings.sharedSongsOnly && eligible === 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No shows in common — turn off &ldquo;Shared songs only&rdquo; or import more lists.
          </Banner>
        )}

        {!everyoneHasShows && players.length > 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Everyone needs an anime list — tap 🔗 next to a player to import theirs.
          </Banner>
        )}

        {importTarget && (
          <AniListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {preparing && progress && (
          <div className="mb-4">
            <p className="mb-2 text-center text-base text-white/60">
              {progress.phase === 'resolving' ? 'Matching your shows…' : 'Loading themes…'}{' '}
              {progress.done}/{progress.total}
            </p>
            <div
              className="h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2"
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemin={0}
              aria-valuemax={progress.total}
            >
              <div
                className="h-full bg-pop-blue transition-[width]"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-white/30">
              First time takes a moment; after that it&apos;s cached.
            </p>
          </div>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => {
            savePrefs(settings);
            onStart({ players, ...settings });
          }}
          disabled={!canStart}
        >
          {preparing ? 'Preparing…' : '🎮 Start Game'}
        </Button>
      </Screen>
    </>
  );
}
