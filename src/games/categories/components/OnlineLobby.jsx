import { useState } from 'react';
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

// The online lobby. Mirrors AniWave's and AniFake's: room code to share, live
// player list, host-only settings and Start.
//
// THE SETTINGS CARD IS NOT HERE — it is AniTagSettings, shared with the local
// setup screen. It used to be a hundred lines duplicated between the two files,
// which is precisely the near-twin drift CLAUDE.md warns about: every change had
// to be made twice, and a missed one is invisible until somebody plays the other
// half of the game.
//
// NO PROFILE-REPUBLISHING EFFECT, and its absence is deliberate rather than
// forgotten. Every other lobby in the arcade runs one, because their pools are
// computed from the copies of everyone's anime lists sitting in the room, so a
// list imported after joining has to be pushed back up. AniTag reads nobody's
// list, so the room copy of a profile is only ever a name — and a name cannot
// go stale in the way profileFingerprint exists to catch.
//
// THE CATEGORY EDITOR IS SHOWN TO EVERYONE, not just the host, and both modes
// give the same reason. What a player writes stays on their own device: in
// chosen mode it heads the list they pick their own clause from, and in dealt
// mode it is drawn from when that device is one of the two dealers (see
// useCategoriesRoom). Either way a guest writing a clause is not a setting they
// cannot apply — it is content that reaches the table through them. The
// host-only gate belongs on the settings card and nowhere else.
export default function OnlineLobby({ room }) {
  const { prefs, savePrefs, resetPrefs } = useGamePrefs('anitag', DEFAULT_PREFS);
  const { categories, saveCategory, deleteCategory } = useCustomCategories();

  // ONE OBJECT RATHER THAN FIVE useStates, because this object IS what leaves
  // the host's device: a key missing from it never reaches the room at all, and
  // assembling it from five separate pieces at the call site is how one goes
  // missing. `customCategories` is deliberately not among them — see
  // useCategoriesRoom.
  const [settings, setSettings] = useState(() => ({
    rounds: prefs.rounds,
    proposalCap: prefs.proposalCap,
    categoryPool: prefs.categoryPool,
    categoryMode: prefs.categoryMode,
    useCustom: prefs.useCustom,
  }));
  const change = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const players = room.players ?? [];
  const active = room.activePlayers ?? players;
  const statuses = room.playerStatuses ?? {};
  const pool = POOL_LABELS[settings.categoryPool] ?? POOL_LABELS.characters;
  // Counts only the players actually here: a ghost left by a closed tab would
  // otherwise satisfy the minimum and hand somebody absent the opening go.
  const enoughPlayers = active.length >= MIN_PLAYERS;

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="lime" size="md" className="mb-8">AniTag</Wordmark>

        <div className="mb-8 text-center">
          <p className="mb-3 text-white/50">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl tracking-[0.3em] text-ink">
            {room.roomCode}
          </span>
        </div>

        <Banner tone="info" className="mb-6">{NO_LIST_NEEDED}</Banner>

        <Card title={`Players (${active.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const status = statuses[p.id] ?? 'active';
            const here = status === 'active' || status === 'dropping';
            return (
              <CardRow key={p.id} className={here ? '' : 'opacity-40'}>
                <span className="min-w-0 flex-1 truncate text-white">
                  {p.id === room.hostId && <span title="Host">👑 </span>}
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-lime">(you)</span>}
                </span>
                {/* No list badge, unlike every other lobby in the arcade —
                    nothing here reads an anime list, so it would be a warning
                    about nothing and would contradict the banner above. */}
                {status === 'dropping' && <Badge tone="amber">Reconnecting…</Badge>}
                {!here && <Badge tone="neutral">Left</Badge>}
              </CardRow>
            );
          })}
        </Card>

        {room.isHost ? (
          <>
            <AniTagSettings
              values={settings}
              onChange={change}
              playerCount={active.length}
              customCategories={categories}
              onReset={() => { setSettings({ ...DEFAULT_PREFS }); resetPrefs(); }}
            />

            {!enoughPlayers && (
              <Banner tone="warning" className="mb-6">
                ⚠️ Needs {MIN_PLAYERS} players — somebody has to be able to answer.
              </Banner>
            )}
          </>
        ) : (
          <p className="mb-6 text-center text-base text-white/50">
            Waiting for {room.hostName || 'the host'} to start…
          </p>
        )}

        <CategoryEditor
          categories={categories}
          onSave={saveCategory}
          onDelete={deleteCategory}
          noun={pool.noun}
        />

        {room.isHost && (
          <Button
            variant="primary"
            size="xl"
            fullWidth
            disabled={!enoughPlayers}
            onClick={() => {
              savePrefs(settings);
              room.startGame(settings);
            }}
          >
            🎮 Start Game
          </Button>
        )}
      </Screen>
    </>
  );
}
