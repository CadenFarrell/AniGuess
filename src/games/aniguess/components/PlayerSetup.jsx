import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import { useWins } from '../../../shared/hooks/useWins';
import { useGamePrefs } from '../../../shared/hooks/useGamePrefs';
import { normalizeTitle } from '../../../shared/utils/ranking';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import SettingsFooter from '../../../shared/components/SettingsFooter';
import { DEFAULT_PREFS, POSITIONS } from '../prefs';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Modal, NumberInput, Screen,
  Wordmark,
} from '../../../shared/ui';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePlayer({ player, isYou, onRemove, onGoToList }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const totalCharacters = player.animeList.reduce(
    (sum, anime) => sum + anime.characters.length, 0
  );

  return (
    <div ref={setNodeRef} style={style} className="card-pop mb-3 flex items-center gap-3 p-4">
      <span
        {...attributes}
        {...listeners}
        className="focus-pop cursor-grab rounded-pop-sm px-1 text-2xl text-white/40 hover:text-white"
      >
        ☰
      </span>
      <span className="min-w-0 flex-1 truncate font-display font-extrabold text-lg text-white">
        {player.name}
      </span>
      {isYou && <Badge tone="purple">You</Badge>}
      <Badge tone={totalCharacters > 0 ? 'lime' : 'amber'}>
        {totalCharacters > 0 ? `${totalCharacters} chars` : '⚠️ No chars'}
      </Badge>
      <Button variant="neutral" size="sm" onClick={() => onGoToList(player)}>
        ✏️ Edit List
      </Button>
      <button
        onClick={() => onRemove(player.id)}
        aria-label={`Remove ${player.name}`}
        className="focus-pop grid h-11 w-11 flex-shrink-0 place-items-center rounded-pop-sm text-lg font-black text-pop-red hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}

export default function PlayerSetup({ onStartGame, onGoToList, players, onPlayersChange, onBack }) {
  const { activeId } = useProfileStore();
  const { getWins, resetWins } = useWins();
  const [showPicker, setShowPicker] = useState(false);
  const [showWins, setShowWins] = useState(false);
  // Seeded from whatever this device last started a game with, not from the
  // literal defaults — see shared/hooks/useGamePrefs.js.
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('aniguess', DEFAULT_PREFS);
  const [twoStepRandom, setTwoStepRandom] = useState(prefs.twoStepRandom);
  const [timerEnabled, setTimerEnabled] = useState(prefs.timerEnabled);
  const [sharedShowsOnly, setSharedShowsOnly] = useState(prefs.sharedShowsOnly);
  const [talkMode, setTalkMode] = useState(prefs.talkMode);
  const [timerSeconds, setTimerSeconds] = useState(prefs.timerSeconds);
  const [pointsPerPosition, setPointsPerPosition] = useState(prefs.pointsPerPosition);

  const settings = {
    timerEnabled, timerSeconds, pointsPerPosition, sharedShowsOnly, twoStepRandom, talkMode,
  };

  const applyDefaults = () => {
    setTwoStepRandom(DEFAULT_PREFS.twoStepRandom);
    setTimerEnabled(DEFAULT_PREFS.timerEnabled);
    setSharedShowsOnly(DEFAULT_PREFS.sharedShowsOnly);
    setTalkMode(DEFAULT_PREFS.talkMode);
    setTimerSeconds(DEFAULT_PREFS.timerSeconds);
    // Copied, not shared — updatePoints edits a clone today, but handing module
    // state straight into a setter is a trap waiting for the next edit.
    setPointsPerPosition([...DEFAULT_PREFS.pointsPerPosition]);
    resetPrefs();
  };

  const sensors = useSensors(useSensor(PointerSensor));

  const removePlayer = (id) => onPlayersChange(players.filter((p) => p.id !== id));

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      onPlayersChange(arrayMove(players, oldIndex, newIndex));
    }
  };

  // NumberInput hands over an already-parsed, already-clamped number, so this
  // no longer parses anything — it only writes the slot.
  const updatePoints = (i, n) => {
    const updated = [...pointsPerPosition];
    updated[i] = n;
    setPointsPerPosition(updated);
  };

  const allHaveChars = players.every(
    (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0) > 0
  );
  const hasSharedAnime = players.length < 2 || players.some((p, i) =>
    players.some((other, j) => i !== j &&
      p.animeList.some(a => other.animeList.some(o => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = players.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  const winsEntries = showWins ? Object.entries(getWins()).sort((a, b) => b[1] - a[1]) : [];

  const handleResetWins = () => {
    if (window.confirm('Reset all-time wins? This cannot be undone.')) {
      resetWins();
      setShowWins(false);
    }
  };

  return (
    <>
      <Backdrop />
      <Screen width="md" onBack={onBack}>
        <div className="mb-10 text-center">
          <Wordmark tone="pink">AniGuess</Wordmark>
          <p className="mt-5 text-lg text-white/60">The anime character guessing game</p>
          <Button
            variant="neutral"
            size="sm"
            className="mt-4"
            onClick={() => setShowWins(true)}
          >
            🏅 All-Time Leaderboard
          </Button>
        </div>

        {showWins && (
          <Modal onClose={() => setShowWins(false)} width="sm">
            <h2 className="mb-6 font-display text-3xl font-extrabold text-white">
              🏅 All-Time Wins
            </h2>
            {winsEntries.length === 0
              ? <p className="py-4 text-center text-white/40">No games played yet!</p>
              : winsEntries.map(([name, count], i) => (
                <CardRow key={name}>
                  <span className="text-lg text-white">{i === 0 ? '👑 ' : ''}{name}</span>
                  <span className="font-display text-xl font-extrabold text-pop-amber">
                    {count} W
                  </span>
                </CardRow>
              ))
            }
            <div className="mt-6 flex gap-3">
              <Button variant="neutral" fullWidth onClick={() => setShowWins(false)}>
                Close
              </Button>
              {winsEntries.length > 0 && (
                <Button variant="danger" fullWidth onClick={handleResetWins}>
                  Reset
                </Button>
              )}
            </div>
          </Modal>
        )}

        {/* Add Player. A picker, not a name box: everyone on this couch is
            already saved on the device, and retyping their name was one typo
            away from seating a brand-new empty profile that looked like theirs.
            Importing a list is per-row (✏️ Edit List) — it has to work for
            someone already seated, which a name box never could. */}
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
            onPick={(profile) => onPlayersChange([...players, profile])}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* Player List */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {players.map((p) => (
              <SortablePlayer
                key={p.id}
                player={p}
                isYou={p.id === activeId}
                onRemove={removePlayer}
                onGoToList={onGoToList}
              />
            ))}
          </SortableContext>
        </DndContext>

        {players.length < 2 && (
          <p className="mb-5 text-center text-base text-white/40">
            Add at least 2 players to start
          </p>
        )}
        {players.length >= 2 && sharedShowsOnly && !hasSharedAnime && (
          <Banner tone="warning" className="mb-5">
            ⚠️ No anime titles are shared between all players — uncheck &quot;Shared shows
            only&quot; or add matching titles.
          </Banner>
        )}

        <Card title="⚙️ Settings" padding="lg" className="mb-8 mt-4">
          <Checkbox
            label="Anime-first randomizer"
            checked={twoStepRandom}
            onChange={(e) => setTwoStepRandom(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="Enable Timer"
            checked={timerEnabled}
            onChange={(e) => setTimerEnabled(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="Shared shows only"
            checked={sharedShowsOnly}
            onChange={(e) => setSharedShowsOnly(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="🗣️ Talk it out"
            checked={talkMode}
            onChange={(e) => setTalkMode(e.target.checked)}
            className="mb-2"
          />
          <p className="mb-5 ml-10 text-base text-white/50">
            Ask your questions and say your guess out loud — the table taps what happened
            and the turn passes on that one tap. Nothing is typed, so instead of a question
            history you get a running ✅/❌ trail of each player&apos;s answers.
          </p>

          {timerEnabled && (
            <div className="mb-5 flex items-center gap-3 text-lg text-white/70">
              <span>Seconds:</span>
              {/* Steps by 15 — 30 to 300 in ones is 270 presses. */}
              <NumberInput
                size="sm"
                value={timerSeconds}
                min={30}
                max={300}
                step={15}
                ariaLabel="Timer seconds"
                onChange={setTimerSeconds}
                className="w-44"
              />
            </div>
          )}

          <div>
            <p className="mb-1 text-base text-white/70">Points per position:</p>
            {/* One per row rather than four across. Four steppers sharing a row
                left the number narrower than either of its own buttons, and the
                online lobby's max-w-md card had no width for them at all. */}
            {POSITIONS.map(({ icon, label }, i) => (
              <CardRow key={label}>
                <span className="text-white/80">
                  <span className="mr-2 text-lg">{icon}</span>
                  {label}
                </span>
                <NumberInput
                  size="sm"
                  value={pointsPerPosition[i]}
                  min={0}
                  max={99}
                  ariaLabel={`Points for ${label}`}
                  onChange={(n) => updatePoints(i, n)}
                  className="w-40 flex-shrink-0"
                />
              </CardRow>
            ))}
          </div>

          <SettingsFooter values={settings} defaults={DEFAULT_PREFS} onReset={applyDefaults} />
        </Card>

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => {
            savePrefs(settings);
            onStartGame({ players, settings });
          }}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
      </Screen>
    </>
  );
}
