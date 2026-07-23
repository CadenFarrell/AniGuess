import { useState } from 'react';
import { useProfile } from '../../../shared/hooks/useProfile';
import AniListImport from '../../../shared/components/AniListImport';
import { normalizeTitle } from '../../../shared/utils/ranking';
import {
  Backdrop, Badge, Banner, Button, Card, CardRow, Checkbox, Input, Screen, Wordmark,
} from '../../../shared/ui';

export default function OnlineLobby({ room }) {
  const { saveProfile } = useProfile();
  const [sharedShowsOnly, setSharedShowsOnly] = useState(true);
  const [twoStepRandom, setTwoStepRandom] = useState(false);
  const [pointsPerPosition, setPointsPerPosition] = useState([3, 2, 1, 0]);
  const [showImport, setShowImport] = useState(false);

  const players = room.gameSession?.players ?? [];
  const me = players.find((p) => p.id === room.myPlayerId) ?? null;

  const charCount = (p) => p.animeList.reduce((s, a) => s + a.characters.length, 0);
  const allHaveChars = players.every((p) => charCount(p) > 0);
  // Same guard local setup applies: with "shared shows only" on and no
  // overlapping titles there'd be nothing assignable once the game started.
  const hasSharedAnime = players.length < 2 || players.some((p, i) =>
    players.some((other, j) => i !== j &&
      p.animeList.some((a) => other.animeList.some((o) => normalizeTitle(o.title) === normalizeTitle(a.title))))
  );
  const canStart = players.length >= 2 && allHaveChars && (!sharedShowsOnly || hasSharedAnime);

  const updatePoints = (i, val) => {
    const updated = [...pointsPerPosition];
    updated[i] = parseInt(val) || 0;
    setPointsPerPosition(updated);
  };

  const handleStart = () => {
    room.handleStartGame({
      players,
      settings: { timerEnabled: false, timerSeconds: 60, pointsPerPosition, sharedShowsOnly, twoStepRandom },
    });
  };

  return (
    <>
      <Backdrop />
      <Screen>
        <Wordmark tone="purple" size="sm" level={2} className="mb-6">
          🌐 Room Lobby
        </Wordmark>

        <div className="mb-8 text-center">
          <p className="mb-3 text-white/50">Share this code with the other players:</p>
          <span className="sticker inline-block bg-pop-lime px-6 py-3 text-4xl text-ink tracking-[0.3em]">
            {room.roomCode}
          </span>
        </div>

        <Card title={`Players (${players.length})`} padding="lg" className="mb-6">
          {players.map((p) => {
            const chars = charCount(p);
            return (
              <CardRow key={p.id}>
                <span className="text-white">
                  {p.name}{' '}
                  {p.id === room.myPlayerId && <span className="text-pop-purple">(you)</span>}
                </span>
                <Badge tone={chars > 0 ? 'lime' : 'amber'}>
                  {chars > 0 ? `${chars} chars` : '⚠️ No chars'}
                </Badge>
              </CardRow>
            );
          })}
          {players.length < 2 && (
            <p className="mt-3 text-sm text-white/40">Waiting for more players to join…</p>
          )}
        </Card>

        <Button
          variant="neutral"
          size="md"
          fullWidth
          className="mb-6"
          onClick={() => setShowImport(true)}
          disabled={!me}
        >
          🔗 Import my list from AniList
        </Button>

        <Card title="⚙️ Settings" padding="lg" className="mb-6">
          <Checkbox
            label="Shared shows only"
            checked={sharedShowsOnly}
            onChange={(e) => setSharedShowsOnly(e.target.checked)}
            className="mb-4"
          />
          <Checkbox
            label="Anime-first randomizer"
            checked={twoStepRandom}
            onChange={(e) => setTwoStepRandom(e.target.checked)}
            className="mb-5"
          />

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
          <p className="mt-4 text-sm text-white/30">
            Whoever presses Start applies their settings to everyone.
          </p>
        </Card>

        {players.length >= 2 && !allHaveChars && (
          <Banner tone="warning" className="mb-4">
            ⚠️ Every player needs at least one character before you can start.
          </Banner>
        )}
        {players.length >= 2 && allHaveChars && sharedShowsOnly && !hasSharedAnime && (
          <Banner tone="warning" className="mb-4">
            ⚠️ No anime titles overlap between players — turn off &quot;Shared shows only&quot; or
            import matching titles.
          </Banner>
        )}

        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={handleStart}
          disabled={!canStart}
        >
          🎮 Start Game
        </Button>

        {showImport && me && (
          <AniListImport
            profile={me}
            onClose={() => setShowImport(false)}
            onImported={(merged) => {
              saveProfile(merged);
              room.updateMyProfile(merged);
              setShowImport(false);
            }}
          />
        )}
      </Screen>
    </>
  );
}
