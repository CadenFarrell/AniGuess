import { useState } from 'react';
import { useProfileStore } from '../../../shared/context/profileContext';
import AniListImport from '../../../shared/components/AniListImport';
import ProfilePicker from '../../../shared/components/ProfilePicker';
import { eligibleShows } from '../utils/deck';
import { BOARD_SIZE } from '../rules';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, GhostButton, Screen, Wordmark,
} from '../../../shared/ui';

// Local setup. Same shape as AniTuneSetup — your main profile is already
// seated, the picker adds the rest of the couch, and nobody types a name.
export default function BlindRankSetup({ onStart, onExit, error }) {
  const { activeId, activeProfile, saveProfile } = useProfileStore();
  const [players, setPlayers] = useState(() => (activeProfile ? [activeProfile] : []));
  const [showPicker, setShowPicker] = useState(false);
  const [importTarget, setImportTarget] = useState(null);
  const [sharedOnly, setSharedOnly] = useState(true);

  const handleImported = (merged) => {
    saveProfile(merged);
    setPlayers((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setImportTarget(null);
  };

  const eligible = eligibleShows(players, { sharedOnly });
  const enough = eligible.length >= BOARD_SIZE;
  const canStart = players.length >= 1 && enough;

  return (
    <>
      <Backdrop />
      <Screen width="md">
        <Wordmark
          tone="amber"
          subtitle="Rank ten shows oldest to newest — one at a time, no takebacks"
          className="mb-10"
        >
          Blind Rank
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

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared shows only"
            checked={sharedOnly}
            onChange={(e) => setSharedOnly(e.target.checked)}
            className="mb-2"
          />
          <p className="ml-10 text-base text-white/50">
            Only use shows <em>everyone</em> has on their list. Everyone ranks the same ten,
            so a show only one player knows is a free guess for the rest.
          </p>
        </Card>

        {players.length > 0 && (
          <p className="mb-4 text-center text-base text-white/50">
            {eligible.length} show{eligible.length === 1 ? '' : 's'} to draw from
            {sharedOnly && players.length > 1 && ' (shared by everyone)'}
          </p>
        )}

        {/* With a small shared list this is the ordinary outcome, not an edge
            case, so it gets a reason rather than a dead Start button. */}
        {players.length > 0 && !enough && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Need {BOARD_SIZE} shows with a known air date to fill a board — found {eligible.length}.
            {sharedOnly && players.length > 1
              ? ' Turn off “Shared shows only”, or import more lists.'
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
          onClick={() => onStart({ players, sharedOnly })}
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
