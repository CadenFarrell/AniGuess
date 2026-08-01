import { useState } from 'react';
import { games } from './registry';
import ListManager from '../shared/components/ListManager';
import ProfileButton from '../shared/components/ProfileButton';
import ProfilePicker from '../shared/components/ProfilePicker';
import { useProfileStore } from '../shared/context/profileContext';
import { Backdrop, Badge, GhostButton, Screen, Wordmark } from '../shared/ui';

// Tile fill plus the border the card adopts on hover, so each game "lights up"
// in its own colour rather than every card sharing one highlight.
const ACCENTS = {
  pink: { tile: 'bg-pop-pink', hover: 'hover:border-pop-pink' },
  purple: { tile: 'bg-pop-purple', hover: 'hover:border-pop-purple' },
  lime: { tile: 'bg-pop-lime', hover: 'hover:border-pop-lime' },
  amber: { tile: 'bg-pop-amber', hover: 'hover:border-pop-amber' },
  blue: { tile: 'bg-pop-blue', hover: 'hover:border-pop-blue' },
};

// One game on the menu. Built on `btn-pop` directly rather than <Button> —
// it needs a two-line body and its own colour-tile layout, which the plain
// label-in-a-block Button API does not cover.
function GameCard({ game, onPick }) {
  const accent = ACCENTS[game.accent] ?? ACCENTS.pink;

  return (
    <button
      onClick={() => onPick(game.id)}
      disabled={!game.available}
      className={`btn-pop focus-pop group w-full flex items-center gap-4 p-4 text-left
        transition-colors bg-surface
        ${game.available ? 'border-white/15 ' + accent.hover : 'border-white/10'}`}
    >
      {/* Colour tile. Saturation is what marks a game as playable, so the
          unavailable one reads as "off" even without the badge. */}
      <span
        aria-hidden="true"
        className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-pop-sm border-2 border-ink
          text-3xl ${accent.tile} ${game.available ? '' : 'grayscale opacity-50'}`}
      >
        {game.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`font-display text-xl font-extrabold uppercase tracking-wide
              ${game.available ? 'text-white' : 'text-white/40'}`}
          >
            {game.title}
          </span>
          {!game.available && <Badge tone="amber">🔒 Soon</Badge>}
        </span>
        {/* btn-pop makes everything inside display-bold; the blurb is body copy
            and has to opt back out. */}
        <span
          className={`mt-1.5 block font-sans text-sm font-normal normal-case tracking-normal
            ${game.available ? 'text-white/55' : 'text-white/30'}`}
        >
          {game.blurb}
        </span>
      </span>

      {game.available && (
        <span
          aria-hidden="true"
          className="flex-shrink-0 pr-1 text-2xl text-white/30 transition-colors group-hover:text-white"
        >
          ▸
        </span>
      )}
    </button>
  );
}

// Top-level menu. Picks a game from the registry and hands it the whole screen;
// each game gets an onExit callback to come back here.
export default function HubScreen() {
  // gameId, not activeId — `activeId` in a profile-aware file means the main
  // profile everywhere else, and two different "active"s in one component is
  // how you end up passing the wrong one.
  const [gameId, setGameId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  // Which profile's anime list is open, or null for the menu. ListManager is a
  // full-height page rather than a dialog, so it gets its own hub view instead
  // of living inside ProfilePicker.
  const [editingListId, setEditingListId] = useState(null);
  const { profiles, activeProfile, saveProfile } = useProfileStore();

  const active = games.find((g) => g.id === gameId);
  if (active) {
    const Game = active.Component;
    return <Game onExit={() => setGameId(null)} />;
  }

  if (editingListId) {
    return (
      <>
        <Backdrop />
        {/* mt-16 clears nothing here (the hub has no fixed HubButton), but the
            same in-flow back row as AniGuess's list view keeps the two screens
            reading identically. */}
        <div className="mx-5 mb-0 pt-6 sm:mx-6">
          <GhostButton onClick={() => setEditingListId(null)}>← Back to hub</GhostButton>
        </div>
        <ListManager
          key={editingListId}
          profile={profiles[editingListId] ?? null}
          onProfileUpdated={saveProfile}
        />
      </>
    );
  }

  return (
    <>
      <Backdrop />
      <ProfileButton profile={activeProfile} onOpen={() => setShowPicker(true)} />
      {/* pt clears the fixed profile pill on short viewports, where a centred
          column can otherwise sit right under it. */}
      <Screen center className="pt-16">
        <Wordmark subtitle="Insert coin" className="mb-4">
          AniArcade
        </Wordmark>

        {/* The only thing left of the old full-width profile card. It points at
            the corner once and then never appears again. */}
        {!activeProfile && (
          <p className="mb-6 text-center text-sm text-white/40">
            No profile yet — tap 👤 up top to set one up.
          </p>
        )}

        <div className={`flex flex-col gap-5 ${activeProfile ? 'mt-6' : ''}`}>
          {games.map((game) => (
            <GameCard key={game.id} game={game} onPick={setGameId} />
          ))}
        </div>
      </Screen>

      {showPicker && (
        <ProfilePicker
          onClose={() => setShowPicker(false)}
          onEditList={(id) => { setShowPicker(false); setEditingListId(id); }}
        />
      )}
    </>
  );
}
