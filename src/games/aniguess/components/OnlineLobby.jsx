import { useEffect, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import { normalizeTitle } from '../../../shared/utils/ranking';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Input, Screen, Wordmark,
} from '../../../shared/ui';

export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  const [sharedShowsOnly, setSharedShowsOnly] = useState(true);
  const [twoStepRandom, setTwoStepRandom] = useState(false);
  const [pointsPerPosition, setPointsPerPosition] = useState([3, 2, 1, 0]);
  // null | 'pick' | 'refresh' — same shape ListManager uses, so the one-tap
  // refresh path behaves identically wherever you reach it from.
  const [importMode, setImportMode] = useState(null);

  const players = room.gameSession?.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  // Everything that gates Start counts only the players actually here. A ghost
  // left behind by a closed tab has no characters, and counting them would
  // block Start for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // The profile store is the source of truth; the room's copy of you is derived
  // from it, and `updateMyProfile` is the ONLY channel between the two —
  // saveProfile writes localStorage and nothing else. Without this effect an
  // import done anywhere but the button below (the hub's ListManager, another
  // tab) never reaches Firebase, and rejoining to refresh stops working the
  // moment the host starts and `open` flips false.
  //
  // Scoped by rendering: this screen only exists pre-start, so there is no
  // separate "is the room still open" check to keep in sync.
  //
  // Comparing the two fingerprints rather than tracking "did I push yet" makes
  // this self-correcting and silent on join, when the copies already agree. The
  // ref is still needed on top: `room` is a fresh object every render, so
  // without it the effect would re-fire and re-write for the whole round trip
  // between the transaction and the snapshot coming back.
  const lastPushedRef = useRef(null);
  useEffect(() => {
    // Only your own seat. Switching to a different profile mid-room must not
    // republish over the seat you claimed — claims/{playerId} is per-seat, and
    // the roster would silently change name and list under everyone else.
    if (!me || !activeProfile || activeProfile.id !== room.myPlayerId) return;
    const mine = profileFingerprint(activeProfile);
    if (mine === profileFingerprint(me) || mine === lastPushedRef.current) return;
    lastPushedRef.current = mine;
    room.updateMyProfile(activeProfile);
  }, [activeProfile, me, room]);

  const charCount = (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0);
  const allHaveChars = active.every((p) => charCount(p) > 0);
  // Same guard local setup applies: with "shared shows only" on and no
  // overlapping titles there'd be nothing assignable once the game started.
  const hasSharedAnime = active.length < 2 || active.some((p, i) =>
    active.some((other, j) => i !== j &&
      p.animeList.some((a) => other.animeList.some((o) => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = active.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  const updatePoints = (i, val) => {
    const updated = [...pointsPerPosition];
    updated[i] = parseInt(val) || 0;
    setPointsPerPosition(updated);
  };

  const handleStart = () => {
    room.handleStartGame({
      // Deal in the players actually here — the turn rotation and the character
      // pool are both built from this list.
      players: active,
      settings: { timerEnabled: false, timerSeconds: 60, pointsPerPosition, sharedShowsOnly, twoStepRandom },
    });
  };

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="purple" size="sm" level={2} className="mb-6">
          🌐 Room Lobby
        </Wordmark>

        <div className="mb-8 text-center">
          <p className="mb-3 text-white/50">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl text-ink tracking-[0.3em]">
            {room.roomCode}
          </span>
        </div>

        <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const chars = charCount(p);
            const status = statuses[p.id] ?? 'active';
            const here = status === 'active' || status === 'dropping';
            return (
              <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
                <span className="text-white">
                  {p.id === room.hostId && <span title="Host">👑 </span>}
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-purple">(you)</span>}
                </span>
                {status === 'dropping' && <Badge tone="amber">🔌 Reconnecting…</Badge>}
                {!here && <Badge tone="red">Left</Badge>}
                {status === 'active' && (
                  <Badge tone={chars > 0 ? 'lime' : 'amber'}>
                    {chars > 0 ? `${chars} chars` : '⚠️ No chars'}
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
            find out you have a problem — the ⚠️ No chars badge and the "every
            player needs a character" banner both render on this screen. */}
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

        {/* Only the host picks the settings and starts the game. Everyone else
            gets a read-only wait: the settings were per-device before, which
            read as a free-for-all — whoever hit Start first silently imposed
            their point values on the whole table. */}
        {!room.isHost && (
          <Card padding="lg" className="mb-6 text-center">
            <div className="mb-2 text-4xl">👑</div>
            <p className="font-display text-lg font-extrabold text-white">
              {room.hostName ? `${room.hostName} is the host` : 'Waiting for the host'}
            </p>
            <p className="mt-1 text-white/50">
              The host picks the settings, then starts the game. Import your list above so
              you&apos;re ready.
            </p>
          </Card>
        )}

        {room.isHost && (<>
        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared shows only"
            checked={sharedShowsOnly}
            onChange={(e) => setSharedShowsOnly(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="Anime-first randomizer"
            checked={twoStepRandom}
            onChange={(e) => setTwoStepRandom(e.target.checked)}
            className="mb-5"
          />

          <p className="mb-3 text-base text-white/70">Points per position:</p>
          <div className="flex gap-4">
            {['🥇', '🥈', '🥉', 'Rest'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <span className="text-lg">{label}</span>
                <Input
                  type="number"
                  value={pointsPerPosition[i]}
                  min={0}
                  aria-label={`Points for ${label}`}
                  onChange={(e) => updatePoints(i, e.target.value)}
                  className="w-16 px-2 text-center text-lg"
                />
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/30">
            You&apos;re the host — your settings apply to everyone.
          </p>
        </Card>

        {active.length >= 2 && !allHaveChars && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Every player needs at least one character before you can start.
          </Banner>
        )}
        {active.length >= 2 && allHaveChars && sharedShowsOnly && !hasSharedAnime && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No anime titles overlap between players — turn off &quot;Shared shows only&quot; or
            import matching titles.
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

        {/* Imports into the profile, never into `me`: the room copy is a
            join-time snapshot that has been through RTDB, and merging out of it
            would roll back any hub-side edit made since and drop the
            anilistImportedIds/anilistImportSettings the checklist reads. The
            effect above republishes it. */}
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
