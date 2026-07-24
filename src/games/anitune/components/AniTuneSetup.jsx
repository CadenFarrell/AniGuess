import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import { getEligibleAnimeList } from '../utils/questionPool';
import { RACE, SIMULTANEOUS } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Field, GhostButton, Input, Screen, Wordmark,
} from '../../../shared/ui';

const MODES = [
  { id: RACE, icon: '🔔', label: 'Race', blurb: 'First correct answer takes the point. Miss and you’re out for that song.' },
  { id: SIMULTANEOUS, icon: '🤫', label: 'Everyone guesses', blurb: 'Pass the device round. Everyone who gets it right scores.' },
];

export default function AniTuneSetup({ onStart, onExit, preparing, progress, error }) {
  const { loadOrCreateProfile } = useProfile();
  const [players, setPlayers] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [mode, setMode] = useState(RACE);
  const [sharedSongsOnly, setSharedSongsOnly] = useState(true);
  const [includeOpenings, setIncludeOpenings] = useState(true);
  const [includeEndings, setIncludeEndings] = useState(true);
  const [roundSize, setRoundSize] = useState(10);
  const [clipSeconds, setClipSeconds] = useState(10);

  const addPlayer = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const { profile } = loadOrCreateProfile(trimmed);
    if (players.some((p) => p.id === profile.id)) {
      setNameInput('');
      return;
    }
    setPlayers([...players, profile]);
    setNameInput('');
  };

  const eligible = getEligibleAnimeList(players, { sharedSongsOnly });
  const everyoneHasShows = players.every((p) => (p.animeList || []).length > 0);
  const canStart =
    players.length >= 1 &&
    everyoneHasShows &&
    eligible.length > 0 &&
    (includeOpenings || includeEndings) &&
    !preparing;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark
          tone="blue"
          subtitle="Name the anime from its opening or ending"
          className="mb-10"
        >
          AniTune
        </Wordmark>

        {/* Add Player */}
        <div className="mb-5 flex gap-3">
          <Input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            placeholder="Enter player name…"
            aria-label="Player name"
            disabled={preparing}
            className="flex-1 text-lg"
          />
          <Button
            variant="secondary"
            size="lg"
            onClick={addPlayer}
            disabled={!nameInput.trim() || preparing}
          >
            Add
          </Button>
        </div>

        {players.length === 0 && (
          <p className="mb-6 text-center text-base text-white/40">
            Add at least one player. Profiles and anime lists are shared with AniGuess.
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
                  <Badge tone={shows ? 'lime' : 'amber'}>
                    {shows ? `${shows} shows` : '⚠️ No list'}
                  </Badge>
                  <button
                    onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
                    disabled={preparing}
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

        {/* Mode picker. aria-pressed rather than a radio group because these are
            two big tappable blocks, not a form control. */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={preparing}
                aria-pressed={selected}
                className={`focus-pop rounded-pop border-2 p-4 text-left transition-colors disabled:opacity-40
                  ${selected
                    ? 'border-pop-blue bg-pop-blue/15'
                    : 'border-white/15 bg-surface hover:border-white/30'}`}
              >
                <span className="text-2xl">{m.icon}</span>
                <p className="mt-1 font-display text-lg font-extrabold text-white">{m.label}</p>
                <p className="mt-1 text-sm text-white/50">{m.blurb}</p>
              </button>
            );
          })}
        </div>

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared songs only"
            checked={sharedSongsOnly}
            disabled={preparing}
            onChange={(e) => setSharedSongsOnly(e.target.checked)}
            className="mb-2"
          />
          {/* ml-10 lines the note up with the label, clearing the 7-unit box
              plus its 3-unit gap. */}
          <p className="mb-5 ml-10 text-base text-white/50">
            Only use shows <em>everyone</em> has on their list, so nobody is guessing blind.
          </p>

          <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
            <Checkbox
              label="Openings"
              checked={includeOpenings}
              disabled={preparing}
              onChange={(e) => setIncludeOpenings(e.target.checked)}
            />
            <Checkbox
              label="Endings"
              checked={includeEndings}
              disabled={preparing}
              onChange={(e) => setIncludeEndings(e.target.checked)}
            />
          </div>

          <div className="flex gap-4">
            <Field label="Questions" htmlFor="anitune-round-size" className="flex-1">
              <Input
                id="anitune-round-size"
                type="number"
                min={1}
                max={50}
                value={roundSize}
                disabled={preparing}
                onChange={(e) => setRoundSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-lg"
              />
            </Field>
            <Field label="Clip length (s)" htmlFor="anitune-clip-seconds" className="flex-1">
              <Input
                id="anitune-clip-seconds"
                type="number"
                min={3}
                max={30}
                value={clipSeconds}
                disabled={preparing}
                onChange={(e) => setClipSeconds(Math.max(3, parseInt(e.target.value) || 3))}
                className="text-lg"
              />
            </Field>
          </div>
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible.length} show{eligible.length === 1 ? '' : 's'} in play
            {sharedSongsOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {players.length > 1 && sharedSongsOnly && eligible.length === 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No shows in common — turn off &ldquo;Shared songs only&rdquo; or import more lists.
          </Banner>
        )}

        {!everyoneHasShows && players.length > 0 && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Everyone needs an anime list. Add one in AniGuess first.
          </Banner>
        )}

        {error && <Banner tone="danger" className="mb-4">{error}</Banner>}

        {preparing && progress && (
          <div className="mb-4">
            <p className="mb-2 text-center text-base text-white/60">
              {progress.phase === 'resolving' ? 'Matching your shows…' : 'Loading themes…'}{' '}
              {progress.done}/{progress.total}
            </p>
            <div
              className="h-4 w-full overflow-hidden rounded-pop-sm border-2 border-ink bg-surface-2"
              role="progressbar"
              aria-valuenow={progress.done}
              aria-valuemin={0}
              aria-valuemax={progress.total}
            >
              <div
                className="h-full bg-pop-blue transition-[width]"
                style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm text-white/30">
              First time takes a moment; after that it&apos;s cached.
            </p>
          </div>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => onStart({
            players, mode, sharedSongsOnly, includeOpenings, includeEndings, roundSize, clipSeconds,
          })}
          disabled={!canStart}
        >
          {preparing ? 'Preparing…' : '🎮 Start Game'}
        </Button>

        <div className="mt-4 text-center">
          <GhostButton onClick={onExit} disabled={preparing}>← Back to hub</GhostButton>
        </div>
      </Screen>
    </>
  );
}
