import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Screen, Wordmark,
} from '../../../shared/ui';
import AniTagSettings from './AniTagSettings';
import CategoryEditor from './CategoryEditor';
import { useCustomCategories } from '../hooks/useCustomCategories';
import { NO_LIST_NEEDED } from '../help';
import { DEFAULT_PREFS, POOL_LABELS } from '../prefs';
import { MIN_PLAYERS } from '../rules';

// Local setup.
//
// THE SHORTEST SETUP SCREEN IN THE ARCADE, and unlike AniWave's it is
// unconditionally short: there is no mode here that needs a card pool, so there
// is no list to count, no shared-only toggle and nobody to nag about importing.
// The banner saying so is the most important thing on the screen — a player
// arriving from AniGuess or AniTune assumes an anime list is required and will
// go and run an import before pressing Start if nothing tells them otherwise.
//
// THE SETTINGS CARD LIVES IN AniTagSettings, shared with the online lobby, for
// the reason stated there: it was the same hundred lines in both files.
export default function AniTagSetup({ onStart, onBack }) {
  const { activeId, activeProfile } = useProfileStore();
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitag', DEFAULT_PREFS);
  const { categories, saveCategory, deleteCategory } = useCustomCategories();

  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  // One object rather than five useStates, matching the lobby — see there.
  const [settings, setSettings] = useState(() => ({
    rounds: prefs.rounds,
    proposalCap: prefs.proposalCap,
    categoryPool: prefs.categoryPool,
    categoryMode: prefs.categoryMode,
    useCustom: prefs.useCustom,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const pool = POOL_LABELS[settings.categoryPool] ?? POOL_LABELS.characters;
  const enoughPlayers = players.length >= MIN_PLAYERS;

  const start = () => {
    // Only the keys this screen owns. writePrefs merges a partial, so anything
    // only the lobby offers survives untouched — see prefs.js.
    savePrefs(settings);
    onStart({
      players,
      ...settings,
      // Resolved here rather than passed as a flag, so the hook takes one list
      // and never has to know the setting existed.
      customCategories: settings.useCustom ? categories : [],
    });
  };

  return (
    <>
      <Backdrop />
      <Screen onBack={onBack}>
        <Wordmark tone="lime" size="md" className="mb-8">AniTag</Wordmark>

        <Banner tone="info" className="mb-6">{NO_LIST_NEEDED}</Banner>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="mb-6"
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
          <Card title={`Players (${players.length})`} padding="sm" className="mb-6">
            {players.map((p) => (
              <CardRow key={p.id}>
                <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-white">
                  {p.name}
                </span>
                {p.id === activeId && <Badge tone="lime">You</Badge>}
                {/* No list badge and no 🔗 import button, unlike every other
                    setup screen in the arcade. Nothing here reads an anime
                    list, so a warning about an empty one would be a warning
                    about nothing — and would quietly contradict the banner. */}
                <button
                  onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                  aria-label={`Remove ${p.name}`}
                  className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                    text-lg font-black text-pop-red hover:text-white"
                >
                  ✕
                </button>
              </CardRow>
            ))}
          </Card>
        )}

        <AniTagSettings
          values={settings}
          onChange={change}
          playerCount={players.length}
          customCategories={categories}
          onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
        />

        <CategoryEditor
          categories={categories}
          onSave={saveCategory}
          onDelete={deleteCategory}
          noun={pool.noun}
        />

        {players.length > 0 && !enoughPlayers && (
          <Banner tone="warning" className="mb-6">
            ⚠️ Needs {MIN_PLAYERS} players — somebody has to be able to answer.
          </Banner>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          disabled={!enoughPlayers}
          onClick={start}
        >
          ▶ Start
        </Button>
      </Screen>
    </>
  );
}
