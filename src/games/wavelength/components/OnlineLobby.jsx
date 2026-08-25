import { useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { profileFingerprint } from '../../../shared/utils/profileStats';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, NumberInput,
  Screen, Wordmark,
} from '../../../shared/ui';
import ClueModePicker from './ClueModePicker';
import { SETTING_HELP, poolTooSmall, sharedOnlyHelp } from '../help';
import {
  DEFAULT_PREFS, MAX_GUESS_SECONDS, MAX_ROUNDS, MIN_GUESS_SECONDS, MIN_ROUNDS,
} from '../prefs';
import { MIN_PLAYERS, needsCardPool } from '../rules';
import { CARD_POOLS, MIN_CARD_POOL, eligibleCards, poolNoun } from '../utils/cards';

// The online lobby. Mirrors AniFake's: room code to share, live player list,
// host-only settings and Start.
//
// This lobby offers a SUPERSET of the local setup screen — the timer only makes
// sense here, where everyone dials at once, rather than on a hot seat being
// passed around a table. savePrefs merges rather than replaces, which is what
// lets the two screens own different subsets without either wiping the other's.
export default function OnlineLobby({ room }) {
  const { activeProfile } = useProfileStore();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniwave', DEFAULT_PREFS);

  const [rounds, setRounds] = useState(prefs.rounds);
  const [timed, setTimed] = useState(prefs.timed);
  const [guessSeconds, setGuessSeconds] = useState(prefs.guessSeconds);
  const [clueMode, setClueMode] = useState(prefs.clueMode);
  const [cardPool, setCardPool] = useState(prefs.cardPool);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);

  // Everything reaching startGame has to be in here: this object IS what leaves
  // the host's device, so a key missing from it never reaches the room at all.
  // clueMode in particular — without it every room would play a typed clue
  // whatever the host chose, and nothing on any screen would look wrong.
  const settings = { rounds, timed, guessSeconds, clueMode, cardPool, sharedOnly };

  const applyDefaults = () => {
    setRounds(DEFAULT_PREFS.rounds);
    setTimed(DEFAULT_PREFS.timed);
    setGuessSeconds(DEFAULT_PREFS.guessSeconds);
    setClueMode(DEFAULT_PREFS.clueMode);
    setCardPool(DEFAULT_PREFS.cardPool);
    setSharedOnly(DEFAULT_PREFS.sharedOnly);
    resetPrefs();
  };

  const players = room.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};
  const needsCards = needsCardPool(clueMode);

  // Republish the profile into the room whenever it changes locally. saveProfile
  // only writes localStorage and the provider; updateMyProfile is the one channel
  // from the store into Firebase. The same effect runs in every other lobby —
  // and it matters more here than it used to, since the pool below is computed
  // from the copies of everyone's lists sitting in the room.
  const lastPushedRef = useRef(null);
  useEffect(() => {
    if (!me || !activeProfile || activeProfile.id !== room.myPlayerId) return;
    const mine = profileFingerprint(activeProfile);
    if (mine === profileFingerprint(me) || mine === lastPushedRef.current) return;
    lastPushedRef.current = mine;
    room.updateMyProfile(activeProfile);
  }, [activeProfile, me, room]);

  // Against the ACTIVE roster, not everyone who ever joined: a ghost left by a
  // closed tab would otherwise count toward a shared pool nobody can draw from.
  const eligible = useMemo(
    () => (needsCards ? eligibleCards(active, { pool: cardPool, sharedOnly }).length : 0),
    [needsCards, active, cardPool, sharedOnly],
  );

  const noun = poolNoun(cardPool);
  // Counts only the players actually here: a ghost left by a closed tab would
  // otherwise satisfy the minimum and hand somebody absent the psychic role.
  const enoughPlayers = active.length >= MIN_PLAYERS;
  const everyoneHasList = !needsCards || active.every((p) => (p.animeList || []).length > 0);
  const canStart = enoughPlayers && everyoneHasList && (!needsCards || eligible >= MIN_CARD_POOL);

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="purple" size="md" className="mb-8">AniWave</Wordmark>

        <div className="mb-8 text-center">
          <p className="mb-3 text-white/50">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl tracking-[0.3em] text-ink">
            {room.roomCode}
          </span>
        </div>

        <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const status = statuses[p.id] ?? 'active';
            const here = status === 'active' || status === 'dropping';
            const shows = (p.animeList || []).length;
            return (
              <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
                <span className="min-w-0 flex-1 truncate text-white">
                  {p.id === room.hostId && <span title="Host">👑 </span>}
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-purple">(you)</span>}
                </span>
                {/* Only in the modes that deal — a list badge on a typed-clue
                    round is a warning about nothing. Whoever it names is the
                    person who has to go and import, so it has to be per-row. */}
                {needsCards && here && (
                  <Badge tone={shows ? 'lime' : 'amber'}>
                    {shows ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                )}
                {status === 'dropping' && <Badge tone="amber">Reconnecting…</Badge>}
                {!here && <Badge tone="neutral">Left</Badge>}
              </CardRow>
            );
          })}
        </Card>

        {room.isHost ? (
          <>
            <ClueModePicker value={clueMode} onChange={setClueMode} />

            <Card title="⚙️ Settings" action={<DetailToggle />} padding="lg" className="mb-6">
              <Field label="Rounds" htmlFor="aniwave-rounds" className="mb-2">
                <NumberInput
                  id="aniwave-rounds"
                  ariaLabel="Rounds"
                  min={MIN_ROUNDS}
                  max={MAX_ROUNDS}
                  value={rounds}
                  onChange={setRounds}
                />
              </Field>
              <SettingHelp className="mb-5" more={SETTING_HELP.rounds.more}>
                {SETTING_HELP.rounds.short}
              </SettingHelp>

              {needsCards && (
                <>
                  <Field label="Cards" className="mb-2">
                    <div className="flex gap-3">
                      {CARD_POOLS.map((pool) => (
                        <Button
                          key={pool}
                          variant={cardPool === pool ? 'secondary' : 'neutral'}
                          size="md"
                          fullWidth
                          aria-pressed={cardPool === pool}
                          onClick={() => setCardPool(pool)}
                        >
                          {pool === 'shows' ? 'Shows' : 'Characters'}
                        </Button>
                      ))}
                    </div>
                  </Field>
                  <SettingHelp className="mb-5" more={SETTING_HELP.cardPool.more}>
                    {SETTING_HELP.cardPool.short}
                  </SettingHelp>

                  <Checkbox
                    label="Shared cards only"
                    checked={sharedOnly}
                    onChange={(e) => setSharedOnly(e.target.checked)}
                    className="mb-2"
                  />
                  <SettingHelp indent more={sharedOnlyHelp({ noun }).more}>
                    {sharedOnlyHelp({ noun }).short}
                  </SettingHelp>

                  <p className="mt-3 mb-5 text-sm text-white/50">
                    {eligible} {noun} to draw from
                    {sharedOnly && active.length > 1 && ' (shared by everyone)'}
                  </p>
                </>
              )}

              <Checkbox
                label="Time the guessing"
                checked={timed}
                onChange={(e) => setTimed(e.target.checked)}
                className="mb-2"
              />
              <SettingHelp indent className="mb-5" more={SETTING_HELP.timed.more}>
                {SETTING_HELP.timed.short}
              </SettingHelp>

              {timed && (
                <Field label="Seconds to dial" htmlFor="aniwave-seconds">
                  <NumberInput
                    id="aniwave-seconds"
                    ariaLabel="Seconds to dial"
                    min={MIN_GUESS_SECONDS}
                    max={MAX_GUESS_SECONDS}
                    step={5}
                    value={guessSeconds}
                    onChange={setGuessSeconds}
                  />
                </Field>
              )}

              <SettingsFooter
                values={settings}
                defaults={{
                  rounds: DEFAULT_PREFS.rounds,
                  timed: DEFAULT_PREFS.timed,
                  guessSeconds: DEFAULT_PREFS.guessSeconds,
                  clueMode: DEFAULT_PREFS.clueMode,
                  cardPool: DEFAULT_PREFS.cardPool,
                  sharedOnly: DEFAULT_PREFS.sharedOnly,
                }}
                onReset={applyDefaults}
              />
            </Card>

            {!enoughPlayers && (
              <Banner tone="warning" className="mb-6">
                ⚠️ Needs {MIN_PLAYERS} players — with one guesser there is no
                spread for the psychic to be read against.
              </Banner>
            )}

            {/* Two different problems, and conflating them sends the wrong
                person to go and import: one player with no list at all is not
                the same as everyone having one and the overlap being thin. */}
            {enoughPlayers && needsCards && !everyoneHasList && (
              <Banner tone="warning" className="mb-6">
                ⚠️ Everyone needs an anime list for this mode — whoever is marked
                ⚠️ above can import one from the hub, or you can switch back to a
                typed clue.
              </Banner>
            )}

            {enoughPlayers && needsCards && everyoneHasList && eligible < MIN_CARD_POOL && (
              <Banner tone="warning" className="mb-6">
                ⚠️ {poolTooSmall({ eligible, noun, sharedOnly, players: active.length })}
              </Banner>
            )}

            <Button
              variant="primary"
              size="xl"
              fullWidth
              disabled={!canStart}
              onClick={() => {
                savePrefs(settings);
                room.startGame(settings);
              }}
            >
              🎮 Start Game
            </Button>
          </>
        ) : (
          <p className="text-center text-base text-white/50">
            Waiting for {room.hostName || 'the host'} to start…
          </p>
        )}
      </Screen>
    </>
  );
}
