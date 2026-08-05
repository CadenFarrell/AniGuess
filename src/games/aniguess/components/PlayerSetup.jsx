import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import { useWins } from '../../../shared/hooks/useWins';
import { normalizeTitle } from '../../../shared/utils/ranking';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Input, Modal, Screen, Wordmark,
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

export default function PlayerSetup({ onStartGame, onGoToList, players, onPlayersChange }) {
  const { activeId } = useProfileStore();
  const { getWins, resetWins } = useWins();
  const [showPicker, setShowPicker] = useState(false);
  const [showWins, setShowWins] = useState(false);
  const [twoStepRandom, setTwoStepRandom] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [sharedShowsOnly, setSharedShowsOnly] = useState(true);
  const [talkMode, setTalkMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [pointsPerPosition, setPointsPerPosition] = useState([3, 2, 1, 0]);

  const sensors = useSensors(useSensor(PointerSensor));

  const removePlayer = (id) => onPlayersChange(players.filter((p) => p.id !== id));

  const handleDragEnd = ({ active, over }) => {
    if (active.id !== over?.id) {
      const oldIndex = players.findIndex((p) => p.id === active.id);
      const newIndex = players.findIndex((p) => p.id === over.id);
      onPlayersChange(arrayMove(players, oldIndex, newIndex));
    }
  };

  const updatePoints = (i, val) => {
    const updated = [...pointsPerPosition];
    updated[i] = parseInt(val) || 0;
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
      <Screen width="md">
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
            Ask your questions and say your guess out loud — the table answers with the
            buttons. Nothing is typed and nothing is logged, so there is no question
            history to look back at.
          </p>

          {timerEnabled && (
            <div className="mb-5 flex items-center gap-3 text-lg text-white/70">
              <span>Seconds:</span>
              <Input
                type="number"
                value={timerSeconds}
                min={30}
                max={300}
                aria-label="Timer seconds"
                onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 60)}
                className="w-24 px-2 text-center text-lg"
              />
            </div>
          )}

          <div>
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
          </div>
        </Card>

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => onStartGame({
            players,
            settings: {
              timerEnabled, timerSeconds, pointsPerPosition, sharedShowsOnly, twoStepRandom,
              talkMode,
            },
          })}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>
      </Screen>
    </>
  );
}
