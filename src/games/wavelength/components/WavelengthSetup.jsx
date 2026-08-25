import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import SettingHelp, { DetailToggle } from '../../../shared/components/SettingHelp';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, NumberInput,
  Screen, Wordmark,
} from '../../../shared/ui';
import ClueModePicker from './ClueModePicker';
import { SETTING_HELP, poolTooSmall, sharedOnlyHelp } from '../help';
import { DEFAULT_PREFS, MAX_ROUNDS, MIN_ROUNDS } from '../prefs';
import { MIN_PLAYERS, needsCardPool } from '../rules';
import { CARD_POOLS, MIN_CARD_POOL, eligibleCards, poolNoun } from '../utils/cards';

// Local setup.
//
// Still the shortest setup screen in the arcade WHEN THE MODE IS 'text' — no
// pool to count, no shared-only toggle, and no reason to nag anyone about
// importing. That is not laziness: a player arriving from AniGuess assumes an
// anime list is required and will go and import one before starting if nothing
// tells them otherwise, so the absence is the thing worth saying out loud.
//
// The two card modes need a pool, and everything about them is gated behind
// that one choice — the toggles, the counts and the warnings all appear only
// once a mode that deals cards is selected, so the default path is unchanged.
export default function WavelengthSetup({ onStart, onBack }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniwave', DEFAULT_PREFS);

  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const [rounds, setRounds] = useState(prefs.rounds);
  const [clueMode, setClueMode] = useState(prefs.clueMode);
  const [cardPool, setCardPool] = useState(prefs.cardPool);
  const [sharedOnly, setSharedOnly] = useState(prefs.sharedOnly);

  const needsCards = needsCardPool(clueMode);

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  // Skipped entirely in the default mode: with no cards to deal there is nothing
  // to count, and walking every player's whole list to reach zero is work done
  // to display nothing.
  const eligible = useMemo(
    () => (needsCards ? eligibleCards(players, { pool: cardPool, sharedOnly }).length : 0),
    [needsCards, players, cardPool, sharedOnly],
  );

  const noun = poolNoun(cardPool);
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const enoughCards = !needsCards || eligible >= MIN_CARD_POOL;
  const canStart = enoughPlayers && enoughCards;

  const start = () => {
    // Only the keys this screen owns. writePrefs merges a partial, so the
    // online-only timer settings survive untouched — see prefs.js.
    savePrefs({ rounds, clueMode, cardPool, sharedOnly });
    onStart({ players, rounds, mode: clueMode, cardPool, sharedOnly });
  };

  return (
    <>
      <Backdrop />
      <Screen onBack={onBack}>
        <Wordmark tone="purple" size="md" className="mb-8">AniWave</Wordmark>

        {!needsCards && (
          <Banner tone="info" className="mb-6">
            No anime list needed — a typed clue is played on the spectrums alone,
            so everyone can join straight away.
          </Banner>
        )}

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-5"
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
            or add a player above.
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
                  {/* Only in the modes that deal: a list badge on a typed-clue
                      round is a warning about nothing, and undoes the banner
                      above it. */}
                  {needsCards && (
                    <>
                      <Badge tone={shows ? 'lime' : 'amber'}>
                        {shows ? `${shows} shows` : '⚠️ No list'}
                      </Badge>
                      <Button
                        variant="neutral"
                        size="sm"
                        className="flex-shrink-0"
                        aria-label={`Import ${p.name}'s list from AniList`}
                        onClick={() => setImportTarget(p)}
                      >
                        🔗
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

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

              {/* The count itself, not only the warning: a mode can be
                  perfectly playable and still narrow a small shared list more
                  than anyone expected, and seeing the number is what makes the
                  shared-only checkbox above it legible. */}
              <p className="mt-3 text-sm text-white/50">
                {eligible} {noun} to draw from
                {sharedOnly && players.length > 1 && ' (shared by everyone)'}
              </p>
            </>
          )}
        </Card>

        {players.length > 0 && !enoughPlayers && (
          <Banner tone="warning" className="mb-6">
            ⚠️ Needs {MIN_PLAYERS} players — with one guesser there is no spread for
            the psychic to be read against.
          </Banner>
        )}

        {/* A reason rather than a dead Start button: with a short shared list
            this is the ordinary outcome, not an edge case, and the remedy
            depends on which cause it is. */}
        {needsCards && enoughPlayers && !enoughCards && (
          <Banner tone="warning" className="mb-6">
            ⚠️ {poolTooSmall({ eligible, noun, sharedOnly, players: players.length })}
          </Banner>
        )}

        {importTarget && (
          <AniListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!canStart}
          onClick={start}
        >
          Start
        </Button>

        {/* Only the keys this screen renders. resetPrefs drops the whole slice
            regardless, which is what "reset to defaults" has to mean — the
            online-only timer options have no other way back. */}
        <SettingsFooter
          values={{ rounds, clueMode, cardPool, sharedOnly }}
          defaults={{
            rounds: DEFAULT_PREFS.rounds,
            clueMode: DEFAULT_PREFS.clueMode,
            cardPool: DEFAULT_PREFS.cardPool,
            sharedOnly: DEFAULT_PREFS.sharedOnly,
          }}
          onReset={() => {
            resetPrefs();
            setRounds(DEFAULT_PREFS.rounds);
            setClueMode(DEFAULT_PREFS.clueMode);
            setCardPool(DEFAULT_PREFS.cardPool);
            setSharedOnly(DEFAULT_PREFS.sharedOnly);
          }}
        />
      </Screen>
    </>
  );
}
