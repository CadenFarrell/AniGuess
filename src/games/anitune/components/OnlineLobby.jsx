import { useEffect, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import AniTuneSettings from './AniTuneSettings';
import { eligibleCount } from '../utils/questionPool';
import { DEFAULT_PREFS } from '../prefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';

// The online lobby. Mirrors src/games/aniguess/components/OnlineLobby.jsx (room
// code to share, live player list, start), but the settings are AniTune's, and
// they are now the same component AniTuneSetup renders rather than a hand-kept
// copy of it — the two offer an identical set, and at seventeen options a copy is
// a promise to drift. Whoever presses Start prepares the round and their settings
// apply to everyone.
export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  // One saved set shared with AniTuneSetup, which offers the same options.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitune', DEFAULT_PREFS);
  const [settings, setSettings] = useState(prefs);
  // null | 'pick' | 'refresh' — see ListManager, which uses the same shape.
  const [importMode, setImportMode] = useState(null);

  const applyDefaults = () => {
    setSettings(DEFAULT_PREFS);
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  const hostName = players.find((p) => p.id === room.hostId)?.name ?? '';

  // Everything that gates Start counts only the players actually here. A ghost
  // left behind by a closed tab has no anime list, and counting them would
  // block Start for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Republish the profile into the room whenever it changes locally. See the
  // long note on the same effect in src/games/aniguess/components/OnlineLobby.jsx:
  // saveProfile only writes localStorage, and updateMyProfile is the one channel
  // from the store into Firebase.
  const lastPushedRef = useRef(null);
  useEffect(() => {
    if (!me || !activeProfile || activeProfile.id !== room.myPlayerId) return;
    const mine = profileFingerprint(activeProfile);
    if (mine === profileFingerprint(me) || mine === lastPushedRef.current) return;
    lastPushedRef.current = mine;
    room.updateMyProfile(activeProfile);
  }, [activeProfile, me, room]);

  const showCount = (p) => (p.animeList || []).length;
  const everyoneHasShows = active.every((p) => showCount(p) > 0);
  const eligible = eligibleCount(active, settings);
  const canStart =
    active.length >= 2 &&
    everyoneHasShows &&
    eligible > 0 &&
    (settings.includeOpenings || settings.includeEndings);

  const handleStart = () => {
    savePrefs(settings);
    room.startGame(settings);
  };

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="blue" size="sm" level={2} className="mb-6">
          🌐 AniTune Lobby
        </Wordmark>

        <div className="mb-8 text-center">
          <p className="mb-3 text-white/50">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl text-ink tracking-[0.3em]">
            {room.roomCode}
          </span>
        </div>

        <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const shows = showCount(p);
            const status = statuses[p.id] ?? 'active';
            const here = status === 'active' || status === 'dropping';
            return (
              <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
                <span className="text-white">
                  {p.id === room.hostId && <span title="Host">👑 </span>}
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-blue">(you)</span>}
                </span>
                {status === 'dropping' && <Badge tone="amber">🔌 Reconnecting…</Badge>}
                {!here && <Badge tone="red">Left</Badge>}
                {status === 'active' && (
                  <Badge tone={shows > 0 ? 'lime' : 'amber'}>
                    {shows > 0 ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                )}
              </CardRow>
            );
          })}
          {active.length < 2 && (
            <p className="mt-3 text-sm text-white/40">Waiting for more players to join…</p>
          )}
        </Card>

        {/* Kept here even though the hub can import too: the lobby is where you
            find out you have a problem — the ⚠️ No list badge and the start
            gates both render on this screen. */}
        <div className="mb-6 flex gap-3">
          <Button
            variant="neutral"
            size="md"
            fullWidth
            onClick={() => setImportMode('pick')}
            disabled={!activeProfile}
          >
            🔗 Import my list from AniList
          </Button>
          {activeProfile?.anilistUsername && (
            <Button
              variant="neutral"
              size="md"
              className="flex-shrink-0 whitespace-nowrap"
              onClick={() => setImportMode('refresh')}
            >
              🔄 Refresh
            </Button>
          )}
        </div>

        {/* Only the host picks the mode and settings and starts the game.
            Everyone else gets a read-only wait so nobody fights over the
            controls (the settings were per-device before, which read as a
            free-for-all). */}
        {!room.isHost && (
          <Card padding="lg" className="mb-6 text-center">
            <div className="mb-2 text-4xl">👑</div>
            <p className="font-display text-lg font-extrabold text-white">
              {hostName ? `${hostName} is the host` : 'Waiting for the host'}
            </p>
            <p className="mt-1 text-white/50">
              The host picks the mode and settings, then starts the game. Import your list
              above so you&apos;re ready.
            </p>
          </Card>
        )}

        {room.isHost && (<>
        <AniTuneSettings
          players={active}
          values={settings}
          onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        />

        <div className="mb-6">
          <p className="text-sm text-white/30">
            You&apos;re the host — your settings apply to everyone.
          </p>
          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </div>

        {active.length >= 2 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} show{eligible === 1 ? '' : 's'} in play
            {settings.sharedSongsOnly && ' (shared by everyone)'}
          </p>
        )}

        {active.length >= 2 && !everyoneHasShows && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Every player needs an anime list before you can start.
          </Banner>
        )}
        {active.length >= 2 && everyoneHasShows && settings.sharedSongsOnly && eligible === 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No anime titles overlap between players — turn off &quot;Shared songs only&quot; or
            import matching titles.
          </Banner>
        )}
        {active.length >= 2 && !settings.includeOpenings && !settings.includeEndings && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Pick openings, endings, or both.
          </Banner>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={handleStart}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
        </>)}

        {/* Imports into the profile, never into `me` — the room copy is a
            join-time snapshot that has been through RTDB. The effect above
            republishes it. */}
        {importMode && activeProfile && (
          <AniListImport
            profile={activeProfile}
            autoRefresh={importMode === 'refresh'}
            onClose={() => setImportMode(null)}
            onImported={(merged) => {
              saveProfile(merged);
              setImportMode(null);
            }}
          />
        )}
      </Screen>
    </>
  );
}
