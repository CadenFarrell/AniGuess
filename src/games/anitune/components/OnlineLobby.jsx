import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import AniListImport from '../../../shared/components/AniListImport';
import { getEligibleAnimeList } from '../utils/questionPool';
import { RACE, SIMULTANEOUS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, Input, Screen, Wordmark,
} from '../../../shared/ui';

const MODES = [
  { id: RACE, icon: '🔔', label: 'Race', blurb: 'First correct answer takes the point. Miss and you’re out for that song.' },
  { id: SIMULTANEOUS, icon: '🤫', label: 'Everyone guesses', blurb: 'Everyone answers at once on their own device. Everyone who gets it right scores.' },
];

// The online lobby. Mirrors src/games/aniguess/components/OnlineLobby.jsx (room
// code to share, live player list, start), but the settings are AniTune's — mode,
// shared-songs, OP/ED, round size, clip length — lifted from AniTuneSetup. Whoever
// presses Start prepares the round and their settings apply to everyone.
export default function OnlineLobby({ room }) {
  const { saveProfile } = useProfile();
  const [mode, setMode] = useState(RACE);
  const [sharedSongsOnly, setSharedSongsOnly] = useState(true);
  const [includeOpenings, setIncludeOpenings] = useState(true);
  const [includeEndings, setIncludeEndings] = useState(true);
  const [roundSize, setRoundSize] = useState(10);
  const [clipSeconds, setClipSeconds] = useState(10);
  const [showImport, setShowImport] = useState(false);

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  const hostName = players.find((p) => p.id === room.hostId)?.name ?? '';

  // Everything that gates Start counts only the players actually here. A ghost
  // left behind by a closed tab has no anime list, and counting them would
  // block Start for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  const showCount = (p) => (p.animeList || []).length;
  const everyoneHasShows = active.every((p) => showCount(p) > 0);
  const eligible = getEligibleAnimeList(active, { sharedSongsOnly });
  const canStart =
    active.length >= 2 &&
    everyoneHasShows &&
    eligible.length > 0 &&
    (includeOpenings || includeEndings);

  const handleStart = () => {
    room.startGame({
      mode, sharedSongsOnly, includeOpenings, includeEndings, roundSize, clipSeconds,
    });
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

        <Button
          variant="neutral"
          size="md"
          fullWidth
          className="mb-6"
          onClick={() => setShowImport(true)}
          disabled={!me}
        >
          🔗 Import my list from AniList
        </Button>

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
        {/* Mode picker — same two blocks as local setup. */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={selected}
                className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors
                  ${selected
                    ? 'border-pop-blue bg-pop-blue/15'
                    : 'border-white/15 bg-surface hover:border-white/30'}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="mt-1 font-display text-lg font-extrabold text-white">{m.label}</p>
                <p className="mt-1 text-sm text-white/50">{m.blurb}</p>
              </button>
            );
          })}
        </div>

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared songs only"
            checked={sharedSongsOnly}
            onChange={(e) => setSharedSongsOnly(e.target.checked)}
            className="mb-2"
          />
          <p className="mb-5 ml-10 text-base text-white/50">
            Only use shows <em>everyone</em> has on their list, so nobody is guessing blind.
          </p>

          <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
            <Checkbox
              label="Openings"
              checked={includeOpenings}
              onChange={(e) => setIncludeOpenings(e.target.checked)}
            />
            <Checkbox
              label="Endings"
              checked={includeEndings}
              onChange={(e) => setIncludeEndings(e.target.checked)}
            />
          </div>

          <div className="flex gap-4">
            <Field label="Questions" htmlFor="anitune-online-round-size" className="flex-1">
              <Input
                id="anitune-online-round-size"
                type="number"
                min={1}
                max={50}
                value={roundSize}
                onChange={(e) => setRoundSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-lg"
              />
            </Field>
            <Field label="Clip length (s)" htmlFor="anitune-online-clip-seconds" className="flex-1">
              <Input
                id="anitune-online-clip-seconds"
                type="number"
                min={3}
                max={30}
                value={clipSeconds}
                onChange={(e) => setClipSeconds(Math.max(3, parseInt(e.target.value) || 3))}
                className="text-lg"
              />
            </Field>
          </div>
          <p className="mt-4 text-sm text-white/30">
            You&apos;re the host — your settings apply to everyone.
          </p>
        </Card>

        {active.length >= 2 && !everyoneHasShows && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Every player needs an anime list before you can start.
          </Banner>
        )}
        {active.length >= 2 && everyoneHasShows && sharedSongsOnly && eligible.length === 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No anime titles overlap between players — turn off &quot;Shared songs only&quot; or
            import matching titles.
          </Banner>
        )}
        {active.length >= 2 && !includeOpenings && !includeEndings && (
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

        {showImport && me && (
          <AniListImport
            profile={me}
            onClose={() => setShowImport(false)}
            onImported={(merged) => {
              saveProfile(merged);
              room.updateMyProfile(merged);
              setShowImport(false);
            }}
          />
        )}
      </Screen>
    </>
  );
}
