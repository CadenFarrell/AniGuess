import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import ModePicker from './ModePicker';
import { eligibleCharacters } from '../utils/pool';
import { DEFAULT_MODE_ID } from '../modes';
import { DEFAULT_CLUE_ROUNDS, MAX_CLUE_ROUNDS, minPool, MIN_PLAYERS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, Input, Screen, Wordmark,
} from '../../../shared/ui';

// The online lobby. Mirrors AniRank's: room code to share, live player list,
// host-only settings and Start.
export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  const [sharedOnly, setSharedOnly] = useState(true);
  const [mode, setMode] = useState(DEFAULT_MODE_ID);
  const [laps, setLaps] = useState(DEFAULT_CLUE_ROUNDS);
  const [importMode, setImportMode] = useState(null); // null | 'pick' | 'refresh'

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  // Everything that gates Start counts only the players actually here: a ghost
  // left by a closed tab has no anime list, and counting it would block Start
  // for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Republish the profile into the room whenever it changes locally. saveProfile
  // only writes localStorage and the provider; updateMyProfile is the one
  // channel from the store into Firebase. See the same effect in AniRank's lobby.
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

  const eligible = useMemo(
    () => eligibleCharacters(active, { sharedOnly }).length,
    [active, sharedOnly]
  );
  // The bar is what the mode needs to deal, not a board size — see the note on
  // rules.minPool. Keyed on `mode` because switching to decoy raises it.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const canStart = active.length >= MIN_PLAYERS && everyoneHasShows && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="teal" size="sm" level={2} className="mb-6">
          🌐 AniFake Lobby
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
                  {p.id === room.myPlayerId && <span className="text-pop-teal">(you)</span>}
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
          {active.length < MIN_PLAYERS && (
            <p className="mt-3 text-sm text-white/40">
              Waiting for more players — AniFake needs {MIN_PLAYERS}.
            </p>
          )}
        </Card>

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

        {!room.isHost && (
          <Card padding="lg" className="mb-6 text-center">
            <div className="mb-2 text-4xl">👑</div>
            <p className="font-display text-lg font-extrabold text-white">
              {room.hostName ? `${room.hostName} is the host` : 'Waiting for the host'}
            </p>
            <p className="mt-1 text-white/50">
              The host picks the settings and starts the game. Import your list above so
              you&apos;re ready.
            </p>
          </Card>
        )}

        {room.isHost && (
          <>
            <ModePicker value={mode} onChange={setMode} />

            <Card title="⚙️ Settings" padding="lg" className="mb-6">
              {/* Clamped in onChange, not by the max attribute — that only
                  bounds the spinner arrows, and a typed 99 would sail past it. */}
              <Field label="Clue rounds" htmlFor="anifake-laps" className="mb-2">
                <Input
                  id="anifake-laps"
                  type="number"
                  min={1}
                  max={MAX_CLUE_ROUNDS}
                  value={laps}
                  onChange={(e) => setLaps(
                    Math.min(MAX_CLUE_ROUNDS, Math.max(1, parseInt(e.target.value) || 1))
                  )}
                  className="text-lg"
                />
              </Field>
              <p className="mb-5 text-base text-white/50">
                How many times round the table before the vote opens. More clues means more
                to go on — and more chances for the fake to trip over their own story.
              </p>

              <Checkbox
                label="Shared characters only"
                checked={sharedOnly}
                onChange={(e) => setSharedOnly(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 text-base text-white/50">
                Only use characters <em>everyone</em> has on their list. The whole table
                gives clues about one of them, so a character only one player has seen
                makes the round unplayable for the rest.
              </p>

              <p className="mt-4 text-sm text-white/30">
                You&apos;re the host — your settings apply to everyone.
              </p>
            </Card>

            {active.length >= MIN_PLAYERS && !everyoneHasShows && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Every player needs an anime list before you can start.
              </Banner>
            )}
            {active.length >= MIN_PLAYERS && everyoneHasShows && !enough && (
              <Banner tone="warning" className="mb-4">
                ⚠️ {needed === 1
                  ? 'Nobody has a character in common — found none.'
                  : `Decoy mode needs ${needed} characters, so the fake can be handed a
                     different one — found ${eligible}.`}
                {sharedOnly ? ' Turn off “Shared characters only”, or import matching titles.' : ''}
              </Banner>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => room.startGame({ sharedOnly, mode, laps })}
              disabled={!canStart}
            >
              🎮 Start Game
            </Button>
          </>
        )}

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
