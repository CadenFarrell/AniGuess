import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import ModePicker from './ModePicker';
import { eligibleCharacters } from '../utils/pool';
import { DEFAULT_MODE_ID } from '../modes';
import { DEFAULT_CLUE_ROUNDS, MAX_CLUE_ROUNDS, minPool, MIN_PLAYERS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, GhostButton, Input, Screen,
  Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniRankSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniFakeSetup({ onStart, onExit, error }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const [sharedOnly, setSharedOnly] = useState(true);
  const [mode, setMode] = useState(DEFAULT_MODE_ID);
  const [laps, setLaps] = useState(DEFAULT_CLUE_ROUNDS);

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const eligible = useMemo(
    () => eligibleCharacters(players, { sharedOnly }).length,
    [players, sharedOnly]
  );
  // Nothing fills a grid anymore, so the bar is what the *mode* needs to deal:
  // one character for blind, two for decoy. That is the whole reason the old
  // sixteen-character minimum is gone — it was a board size, and under "shared
  // characters only" it locked out most tables.
  const needed = minPool(mode);
  const enough = eligible >= needed;
  const enoughPlayers = players.length >= MIN_PLAYERS;
  const canStart = enoughPlayers && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark
          tone="teal"
          subtitle="Everyone knows the character. One of you is faking it."
          className="mb-10"
        >
          AniFake
        </Wordmark>

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
            or add a player above. Profiles and anime lists are shared with every game.
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
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    aria-label={`Remove ${p.name}`}
                    className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm
                      text-lg font-black text-pop-red hover:text-white disabled:opacity-30"
                  >
                    ✕
                  </button>
                </CardRow>
              );
            })}
          </Card>
        )}

        <ModePicker value={mode} onChange={setMode} />

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          {/* Clamped in onChange, not by the max attribute — that only bounds
              the spinner arrows, and a typed 99 would sail past it. */}
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
            How many times round the table before the vote opens. More clues means more to
            go on — and more chances for the fake to trip over their own story.
          </p>

          <Checkbox
            label="Shared characters only"
            checked={sharedOnly}
            onChange={(e) => setSharedOnly(e.target.checked)}
            className="mb-2"
          />
          <p className="ml-10 text-base text-white/50">
            Only use characters <em>everyone</em> has on their list. The whole table gives
            clues about one of them, so a character only one player has seen makes the
            round unplayable for the rest — and unfalsifiable for the fake.
          </p>
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} character{eligible === 1 ? '' : 's'} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {players.length > 0 && players.length < MIN_PLAYERS && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Needs {MIN_PLAYERS} players — with fewer, spotting the odd one out is a
            coin toss.
          </Banner>
        )}

        {/* With a small shared list this is the ordinary outcome, not an edge
            case, so it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ {needed === 1
              ? 'Nobody has a character in common — found none.'
              : `Decoy mode needs ${needed} characters, so the fake can be handed a different
                 one — found ${eligible}.`}
            {sharedOnly && players.length > 1
              ? ' Turn off “Shared characters only”, or import more lists.'
              : ' Import a bigger list with the 🔗 button.'}
          </Banner>
        )}

        {importTarget && (
          <AniListImport
            profile={importTarget}
            onClose={() => setImportTarget(null)}
            onImported={handleImported}
          />
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => onStart({ players, sharedOnly, mode, laps })}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>

        <div className="mt-4 text-center">
          <GhostButton onClick={onExit}>← Back to hub</GhostButton>
        </div>
      </Screen>
    </>
  );
}
