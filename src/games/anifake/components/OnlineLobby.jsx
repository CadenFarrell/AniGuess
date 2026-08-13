import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import ModePicker from './ModePicker';
import {
  eligibleCharacters, famousCount, hasAnyFameData, hasFameSignal, MIN_FAME_POOL,
} from '../utils/pool';
import { FAME_LEVELS, getFame } from '../fame';
import { DEFAULT_PREFS } from '../prefs';
import { MAX_CLUE_ROUNDS, MAX_DEALS, minPool, MIN_PLAYERS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, NumberInput, Screen,
  Select, Wordmark,
} from '../../../shared/ui';

// The online lobby. Mirrors AniRank's: room code to share, live player list,
// host-only settings and Start.
export default function OnlineLobby({ room }) {
  const { activeProfile, saveProfile } = useProfileStore();
  // Shares one saved set with the local setup screen. This lobby offers a subset
  // of it (no talk mode), which is why savePrefs merges rather than replaces —
  // hosting a room must not wipe the settings only local play can reach.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anifake', DEFAULT_PREFS);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);
  const [mode, setMode] = useState(prefs.mode);
  const [laps, setLaps] = useState(prefs.laps);
  const [fame, setFame] = useState(prefs.fame);
  const [allowRedeal, setAllowRedeal] = useState(prefs.allowRedeal);
  const [importMode, setImportMode] = useState(null); // null | 'pick' | 'refresh'

  const settings = { mode, laps, sharedOnly, fame, allowRedeal };

  const applyDefaults = () => {
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    setMode(DEFAULT_PREFS.mode);
    setLaps(DEFAULT_PREFS.laps);
    setFame(DEFAULT_PREFS.fame);
    setAllowRedeal(DEFAULT_PREFS.allowRedeal);
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

  // The entries, not just the count — the fame warning asks the same array
  // whether it carries any popularity data. See AniFakeSetup, its twin.
  const poolEntries = useMemo(
    () => eligibleCharacters(active, { sharedOnly }),
    [active, sharedOnly]
  );
  const eligible = poolEntries.length;
  const fameBlind = fame !== 'any' && eligible > 0 && !hasFameSignal(poolEntries);
  const famous = fame === 'any' ? 0 : famousCount(poolEntries, fame);
  const fameTooTight = famous > 0 && famous < MIN_FAME_POOL;
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
              <Field label="Clue rounds" htmlFor="anifake-laps" className="mb-2">
                <NumberInput
                  id="anifake-laps"
                  ariaLabel="Clue rounds"
                  min={1}
                  max={MAX_CLUE_ROUNDS}
                  value={laps}
                  onChange={setLaps}
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
              <p className="mb-5 ml-10 text-base text-white/50">
                Only use characters <em>everyone</em> has on their list. The whole table
                gives clues about one of them, so a character only one player has seen
                makes the round unplayable for the rest.
              </p>

              <Field label="How well known">
                <Select value={fame} onChange={(e) => setFame(e.target.value)} className="text-lg">
                  {FAME_LEVELS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </Select>
              </Field>
              <p className="mb-2 text-base text-white/50">
                {getFame(fame).blurb} Sharing a show is not the same as remembering everyone
                in it — a background character nobody can describe makes every clue
                meaningless and the fake impossible to catch.
              </p>
              {fameBlind && (
                <Banner tone="warning" className="mb-5">
                  {/* Naming which dead end it is, because only one of them is
                      fixed by importing more. See AniFakeSetup, its twin. */}
                  ⚠️ {hasAnyFameData(poolEntries)
                    ? `Only some of these characters have popularity data, so
                       “${getFame(fame).label}” would be judging the whole table on a handful
                       of them.`
                    : `No popularity data on these lists, so “${getFame(fame).label}” has
                       nothing to go on.`}
                  {' '}The deal falls back to picking a lead. Popularity arrived after these
                  lists were imported — open 🔗 and re-import the shows marked “Missing
                  details” to fill it in.
                </Banner>
              )}
              {fameTooTight && (
                <Banner tone="warning" className="mb-5">
                  ⚠️ Only {famous} character{famous === 1 ? '' : 's'}{' '}
                  {famous === 1 ? 'is' : 'are'} well known enough for
                  “{getFame(fame).label}”, so rounds will start repeating. Try a broader
                  setting, or import more lists.
                </Banner>
              )}

              <Checkbox
                label="🃏 Card check before the clues"
                checked={allowRedeal}
                onChange={(e) => setAllowRedeal(e.target.checked)}
                className="mb-2"
              />
              {/* Word for word AniFakeSetup's — see the note there for why the
                  last sentence is stated publicly. */}
              <p className="ml-10 text-base text-white/50">
                Everyone looks at their card first, and anyone who draws a blank can ask for
                a new character. Nobody is told who asked, and a round can be re-dealt at
                most {MAX_DEALS - 1} times. A re-deal changes everyone&apos;s character, but
                not who the fake is — and in Blind the fake can&apos;t ask, since they hold
                no character to not-know.
              </p>

              <p className="mt-4 text-sm text-white/30">
                You&apos;re the host — your settings apply to everyone.
              </p>

              <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
            </Card>

            {/* The host picks the level for the whole room, so the host is who
                needs to see what it costs. Only when the term is live — there is
                no count worth reading when it is not narrowing anything. */}
            {famous > 0 && (
              <p className="mb-4 text-center text-base text-white/50">
                {eligible} shared character{eligible === 1 ? '' : 's'} · “{getFame(fame).label}”
                narrows this to {famous}
              </p>
            )}

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
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings);
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
