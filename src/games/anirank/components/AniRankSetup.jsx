import { useMemo, useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import AxisPicker from './AxisPicker';
import { eligibleItems } from '../utils/deck';
import { AXES, DEFAULT_AXIS_ID, getAxis, isOpinion } from '../axes';
import { BOARD_SIZE } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, GhostButton, Screen, Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniTuneSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function AniRankSetup({ onStart, onExit, error }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const [sharedOnly, setSharedOnly] = useState(true);
  const [axisId, setAxisId] = useState(DEFAULT_AXIS_ID);
  const [scoring, setScoring] = useState(true);

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const axis = getAxis(axisId);
  const opinion = isOpinion(axis);

  // Counted for every axis, not just the selected one, so the picker can show
  // which modes this table can actually play before anyone commits to one.
  const counts = useMemo(() => Object.fromEntries(
    AXES.map((a) => [a.id, eligibleItems(players, { axis: a, sharedOnly }).length])
  ), [players, sharedOnly]);

  const eligible = counts[axis.id] ?? 0;
  const enough = eligible >= BOARD_SIZE;
  const noun = axis.items === 'characters' ? 'characters' : 'shows';
  // The subject is the answer key, so someone has to be guessing at them.
  const enoughPlayers = opinion && scoring ? players.length >= 2 : players.length >= 1;
  const canStart = enoughPlayers && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark
          tone="amber"
          subtitle="Ten cards, one at a time, no takebacks"
          className="mb-10"
        >
          AniRank
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

        <AxisPicker value={axisId} onChange={setAxisId} counts={players.length ? counts : undefined} />

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
            label="Keep score"
            checked={scoring}
            onChange={(e) => setScoring(e.target.checked)}
            className="mb-2"
          />
          <p className="ml-10 text-base text-white/50">
            Turn this off to just build boards and compare them at the end — no answer
            key, no points, nothing to win.
          </p>
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible} {eligible === 1 ? noun.replace(/s$/, '') : noun} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {/* With a small shared list — or a fact axis on a profile imported before
            the stats existed — this is the ordinary outcome, not an edge case, so
            it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Need {BOARD_SIZE} {noun} to fill a board — found {eligible}.
            {axis.kind === 'fact'
              ? ' Re-import a list with the 🔗 button: this mode needs stats that older saved profiles don’t carry.'
              : sharedOnly && players.length > 1
                ? ` Turn off “Shared ${noun} only”, or import more lists.`
                : ' Import a bigger list with the 🔗 button.'}
          </Banner>
        )}

        {players.length === 1 && opinion && scoring && (
          <Banner tone="warning" className="mb-4">
            ⚠️ An opinion round needs someone to guess at the subject. Add a player, or
            turn off “Keep score” to rank on your own.
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
          onClick={() => onStart({ players, sharedOnly, axisId, scoring })}
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
