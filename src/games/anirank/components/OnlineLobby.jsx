import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import AxisPicker from './AxisPicker';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { eligibleItems, opinionPoolCounts } from '../utils/deck';
import { DEFAULT_PREFS, axisIdOf, resolveSavedAxis } from '../prefs';
import { AXES, getAxis } from '../axes';
import { BOARD_SIZE } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Screen, Wordmark,
} from '../../../shared/ui';

// The online lobby. Mirrors AniTune's: room code to share, live player list,
// host-only settings and Start.
export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  // Prompts before the axis state: only an id is remembered, and turning that
  // back into a spec means looking it up among them. Same order as AniRankSetup.
  const { prompts, savePrompt, deletePrompt } = useCustomPrompts();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anirank', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  // An axis SPEC — a string for a built-in, the stored prompt object for a
  // custom one. The object is the whole point online: a guest has never seen the
  // host's prompt text, so the definition has to ride into the room with it.
  const savedAxis = resolveSavedAxis(prefs.axisId, prompts);
  const [axis, setAxis] = useState(savedAxis);
  const [scoring, setScoring] = useState(prefs.scoring);
  // Saved `blind` only counts if the axis came back too — see AniRankSetup.
  const [blind, setBlind] = useState(
    () => (axisIdOf(savedAxis) === prefs.axisId ? prefs.blind : getAxis(savedAxis).defaultBlind)
  );
  const [importMode, setImportMode] = useState(null); // null | 'pick' | 'refresh'

  // Picking a mode resets how it is dealt to that mode's default — see the same
  // handler in AniRankSetup.
  const handleAxisChange = (spec) => {
    setAxis(spec);
    setBlind(getAxis(spec).defaultBlind);
  };

  const remembered = { sharedOnly, scoring, blind, axisId: axisIdOf(axis) };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setScoring(DEFAULT_PREFS.scoring);
    handleAxisChange(DEFAULT_PREFS.axisId);
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  // Everything that gates Start counts only the players actually here: a ghost
  // left by a closed tab has no anime list, and counting it would block Start
  // for everyone present with no way to clear it.
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};

  // Republish the profile into the room whenever it changes locally. saveProfile
  // only writes localStorage and the provider; updateMyProfile is the one
  // channel from the store into Firebase. See the same effect in AniTune's lobby.
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

  const resolved = getAxis(axis);
  const noun = resolved.items === 'characters' ? 'characters' : 'shows';
  // Counted for every axis so the picker can show which modes this room can
  // actually play — a fact axis reads 0 until someone re-imports their list.
  // Custom prompts share two pool counts; see the same memo in AniRankSetup.
  const counts = useMemo(() => {
    const pools = opinionPoolCounts(active, { sharedOnly });
    return {
      ...Object.fromEntries(
        AXES.map((a) => [a.id, eligibleItems(active, { axis: a, sharedOnly }).length])
      ),
      ...Object.fromEntries(prompts.map((p) => [p.id, pools[p.items]])),
    };
  }, [active, sharedOnly, prompts]);

  const eligible = counts[resolved.id] ?? 0;
  const enough = eligible >= BOARD_SIZE;
  const canStart = active.length >= 2 && everyoneHasShows && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark tone="amber" size="sm" level={2} className="mb-6">
          🌐 AniRank Lobby
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
                  {p.id === room.myPlayerId && <span className="text-pop-amber">(you)</span>}
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
            <AxisPicker
              value={axis}
              onChange={handleAxisChange}
              counts={active.length ? counts : undefined}
              prompts={prompts}
              onSavePrompt={savePrompt}
              onDeletePrompt={deletePrompt}
            />

            <Card title="⚙️ Settings" padding="lg" className="mb-6">
              <Checkbox
                label={`Shared ${noun} only`}
                checked={sharedOnly}
                onChange={(e) => setSharedOnly(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 mb-4 text-base text-white/50">
                Only use {noun} <em>everyone</em> has on their list. Everyone ranks the same ten,
                so a card only one player knows is a free guess for the rest.
              </p>

              <Checkbox
                label="Blind ranking"
                checked={blind}
                onChange={(e) => setBlind(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 mb-4 text-base text-white/50">
                Cards arrive one at a time and can&rsquo;t be moved once placed. Turn it off to
                see all ten at once and arrange them freely before locking in.
              </p>

              <Checkbox
                label="Keep score"
                checked={scoring}
                onChange={(e) => setScoring(e.target.checked)}
                className="mb-2"
              />
              <p className="ml-10 text-base text-white/50">
                Turn this off to just build boards and compare them at the end — no answer
                key, no points, nothing to win.
              </p>

              <p className="mt-4 text-sm text-white/30">
                You&apos;re the host — your settings apply to everyone.
              </p>

              <SettingsFooter values={remembered} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
            </Card>

            {active.length >= 2 && !everyoneHasShows && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Every player needs an anime list before you can start.
              </Banner>
            )}
            {active.length >= 2 && everyoneHasShows && !enough && (
              <Banner tone="warning" className="mb-4">
                ⚠️ Need {BOARD_SIZE} {noun} to fill a board — found {eligible}.
                {resolved.kind === 'fact'
                  ? ' This mode needs AniList stats that older saved profiles don’t carry — everyone should refresh their list above.'
                  : sharedOnly ? ` Turn off “Shared ${noun} only”, or import matching titles.` : ''}
              </Banner>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => {
                savePrefs(remembered);
                room.startGame({ sharedOnly, axis, scoring, blind });
              }}
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
