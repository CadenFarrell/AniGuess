import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import AxisPicker from './AxisPicker';
import FormatOption from './FormatOption';
import { useCustomPrompts } from '../hooks/useCustomPrompts';
import { SETTING_HELP, sharedOnlyHelp } from '../help';
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
  const [format, setFormat] = useState(prefs.format);
  const [importMode, setImportMode] = useState(null); // null | 'pick' | 'refresh'

  // Picking a mode resets how it is dealt to that mode's default — see the same
  // handler in AniRankSetup.
  const handleAxisChange = (spec) => {
    setAxis(spec);
    setBlind(getAxis(spec).defaultBlind);
  };

  // Online offers TWO formats where local offers three. Building a list is solo
  // and takes an hour, so the room's version of the tier half is publish-and-
  // compare rather than a builder — which means the S–D-vs-1..N choice has
  // nothing to act on here. Flipping into this half therefore restores whichever
  // tier format is remembered rather than picking one, so using the lobby never
  // silently rewrites a choice only the local builder can express.
  const comparing = format !== 'round';
  const savedTierFormat = prefs.format !== 'round' ? prefs.format : 'tiers';

  const remembered = { sharedOnly, scoring, blind, format, axisId: axisIdOf(axis) };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setScoring(DEFAULT_PREFS.scoring);
    setFormat(DEFAULT_PREFS.format);
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
  // Always the round wording — the settings card below only renders when the
  // room is not comparing tier lists, and a comparison has no board to share a
  // pool for. See help.js.
  const sharedHelp = sharedOnlyHelp({ noun, tiering: false });
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
  // Comparing has no deck to fill and no answer key, so the only requirement is
  // somebody to compare with. It does not gate on anyone having a list either:
  // publishing happens after Start, and a lobby that refused to open because
  // nobody had built one yet would be unopenable for a room where everyone
  // intends to build one.
  const canStart = comparing
    ? active.length >= 2
    : active.length >= 2 && everyoneHasShows && enough;

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
            {/* Above the mode picker because it decides how much of the picker
                applies — the same order and the same reason as AniRankSetup. */}
            <Card title="🎲 Format" padding="lg" className="mb-6">
              <div className="flex flex-col gap-2">
                <FormatOption
                  active={!comparing}
                  onClick={() => setFormat('round')}
                  title="🎲 Round of ten"
                  hint="Ten random cards, everyone ranks the same board, scored against an answer key."
                />
                <FormatOption
                  active={comparing}
                  onClick={() => setFormat(savedTierFormat)}
                  title="📊 Compare tier lists"
                  hint="Everyone sends a list they already built, and the room sees where you agree."
                />
              </div>
            </Card>

            {/* None of the round options mean anything to a comparison: there is
                no deal to make blind, no answer key to score against, and each
                published list already carries the axis it was built with. An
                inert control is worse than an absent one — see AniRankSetup. */}
            {comparing ? (
              <Card padding="lg" className="mb-6">
                <p className="text-base text-white/60">
                  Lists are built in local play and saved to each player&rsquo;s own device.
                  Start, and everyone picks one to send.
                </p>
                <p className="mt-3 text-sm text-white/30">
                  You&apos;re the host — your settings apply to everyone.
                </p>
                <SettingsFooter
                  values={remembered}
                  defaults={DEFAULT_PREFS}
                  onReset={applyDefaults}
                />
              </Card>
            ) : (
              <>
            <AxisPicker
              value={axis}
              onChange={handleAxisChange}
              counts={active.length ? counts : undefined}
              prompts={prompts}
              onSavePrompt={savePrompt}
              onDeletePrompt={deletePrompt}
            />

            <Card title="⚙️ Settings" action={<DetailToggle />} padding="lg" className="mb-6">
              <Checkbox
                label={`Shared ${noun} only`}
                checked={sharedOnly}
                onChange={(e) => setSharedOnly(e.target.checked)}
                className="mb-2"
              />
              <SettingHelp indent className="mb-4" more={sharedHelp.more}>
                {sharedHelp.short}
              </SettingHelp>

              <Checkbox
                label="Blind ranking"
                checked={blind}
                onChange={(e) => setBlind(e.target.checked)}
                className="mb-2"
              />
              <SettingHelp indent className="mb-4" more={SETTING_HELP.blind.more}>
                {SETTING_HELP.blind.short}
              </SettingHelp>

              <Checkbox
                label="Keep score"
                checked={scoring}
                onChange={(e) => setScoring(e.target.checked)}
                className="mb-2"
              />
              <SettingHelp indent more={SETTING_HELP.scoring.more}>
                {SETTING_HELP.scoring.short}
              </SettingHelp>

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
              </>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={() => {
                savePrefs(remembered);
                const settings = { sharedOnly, axis, scoring, blind, format };
                if (comparing) room.startCompare(settings);
                else room.startGame(settings);
              }}
              disabled={!canStart}
            >
              {comparing ? '📊 Open the comparison' : '🎮 Start Game'}
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
