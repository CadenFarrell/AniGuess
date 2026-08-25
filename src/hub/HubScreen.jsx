import { useState } from 'react';
import { games } from './registry';
import ArcadeMark from './ArcadeMark';
import GameIcon from './GameIcon';
import { GAME_ICONS } from './gameIcons';
import ErrorBoundary from '../shared/components/ErrorBoundary';
import ListManager from '../shared/components/ListManager';
import ProfileButton from '../shared/components/ProfileButton';
import ProfilePicker from '../shared/components/ProfilePicker';
import { useProfileStore } from '../shared/context/profileContext';
import { Backdrop, Badge, GhostButton, HubButton, Screen, Wordmark } from '../shared/ui';

// Tile fill plus the border the card adopts on hover, so each game "lights up"
// in its own colour rather than every card sharing one highlight.
const ACCENTS = {
  pink: { tile: 'bg-pop-pink', hover: 'hover:border-pop-pink' },
  purple: { tile: 'bg-pop-purple', hover: 'hover:border-pop-purple' },
  lime: { tile: 'bg-pop-lime', hover: 'hover:border-pop-lime' },
  amber: { tile: 'bg-pop-amber', hover: 'hover:border-pop-amber' },
  blue: { tile: 'bg-pop-blue', hover: 'hover:border-pop-blue' },
  teal: { tile: 'bg-pop-teal', hover: 'hover:border-pop-teal' },
};

// One game on the menu — a cabinet, not a list row. Built on `btn-pop` directly
// rather than <Button>: it needs a full-bleed colour marquee over a two-part
// body, which the plain label-in-a-block Button API does not cover.
function GameCard({ game, onPick }) {
  const accent = ACCENTS[game.accent] ?? ACCENTS.pink;

  return (
    <button
      onClick={() => onPick(game.id)}
      disabled={!game.available}
      // p-0 because the marquee bleeds to the tile's edge, and overflow-hidden is
      // what clips it back to rounded-pop. That clips descendants only, so
      // focus-pop's ring and btn-pop's shadow — both on this element — survive.
      className={`btn-pop focus-pop group flex flex-col overflow-hidden p-0 text-center
        transition-colors bg-surface
        ${game.available ? 'border-white/15 ' + accent.hover : 'border-white/10'}`}
    >
      {/* Colour marquee. Saturation is what marks a game as playable, so the
          unavailable one reads as "off" even without the badge — which is also
          why the icons are ink-on-accent: a silhouette greys out cleanly, where
          an emoji's own palette only ever half-fades.

          The emoji stays as the fallback rather than being deleted. A game
          added tomorrow has a working tile before anybody draws it one, and the
          text sizing below is what that path still needs. */}
      <span className="relative w-full">
        <span
          aria-hidden="true"
          className={`grid aspect-[4/3] w-full place-items-center border-b-2 border-ink
            text-4xl sm:text-5xl ${accent.tile} ${game.available ? '' : 'grayscale opacity-50'}`}
        >
          {/* A definite height, never a percentage. A percentage resolves against
              a height the marquee's own aspect-ratio has not computed yet, so the
              box falls back to sizing itself from the icon — the marquee came out
              square instead of 4:3 and the board grew past the fold. This is the
              same reason the emoji fallback is sized in text-*, not in %. */}
          {GAME_ICONS[game.id]
            ? <GameIcon id={game.id} className="h-20" />
            : game.icon}
        </span>

        {/* The pointer half of the blurb — see blurb-overlay in index.css.
            A sibling of the marquee rather than a child of it, because the
            marquee is aria-hidden and nesting the text inside would drop it out
            of the button's accessible name.

            bg-ink rather than a tint of the accent: it has to be legible over
            all six fills, and ink is the one colour the palette already uses
            behind white text everywhere else. */}
        {game.available && (
          <span
            className="blurb-overlay absolute inset-0 flex items-center justify-center
              bg-ink/90 px-2 py-1.5 font-sans text-xs font-normal normal-case leading-4
              tracking-normal text-white/85
              group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {game.blurb}
          </span>
        )}
      </span>

      <span className="flex w-full flex-1 flex-col px-2 pt-2 pb-2.5">
        <span
          className={`font-display text-sm font-extrabold uppercase tracking-wide
            ${game.available ? 'text-white' : 'text-white/40'}`}
        >
          {game.title}
        </span>
        {/* The touch half of the blurb — see blurb-inline in index.css. No
            reserved height any more: on a pointer this node is not displayed at
            all, so the tile is shorter there and the overlay above does the
            work. btn-pop makes everything inside display-bold, so body copy has
            to opt back out. */}
        {game.available ? (
          <span
            className="blurb-inline mt-1 line-clamp-2 font-sans text-xs font-normal
              normal-case leading-4 tracking-normal text-white/55"
          >
            {game.blurb}
          </span>
        ) : (
          <span className="mt-1 flex items-center justify-center">
            <Badge tone="amber">🔒 Soon</Badge>
          </span>
        )}
      </span>
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
    // Its own boundary, so a render crash inside one game costs that game
    // rather than the arcade. Without it the root boundary caught everything
    // and the only way out was a reload — which meant any bug in the newest
    // game read to a player as the whole app being broken.
    //
    // Keyed by game id so the caught state cannot outlive the game that
    // produced it; going back to the menu unmounts the boundary anyway, and
    // the key makes that true even if this branch is ever reused.
    return (
      <ErrorBoundary key={active.id} onBack={() => setGameId(null)}>
        <Game onExit={() => setGameId(null)} />
      </ErrorBoundary>
    );
  }

  if (editingListId) {
    return (
      <>
        <Backdrop />
        {/* The same fixed control every in-game screen uses. "Hub" is literal
            here — this view IS inside the hub, so leaving it lands on the menu. */}
        <HubButton onClick={() => setEditingListId(null)} />
        {/* The stepping half beside it: 🏠 Hub leaves the flow, this goes back one
            step to the picker the ✏️ was pressed in. No `origin` state like
            AniGuess's — the hub has exactly one route in, so back is always the
            picker. Own column (matching ListManager's) so it lines up with the
            heading below, and it carries the pt-16 that clears the fixed button. */}
        <div className="mx-auto max-w-2xl px-5 pt-16 sm:px-6">
          <GhostButton onClick={() => { setEditingListId(null); setShowPicker(true); }}>
            ← Profiles
          </GhostButton>
        </div>
        <ListManager
          key={editingListId}
          profile={profiles[editingListId] ?? null}
          onProfileUpdated={saveProfile}
          // The row above clears the fixed button, so this only needs the gap.
          className="pt-4"
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
      <Screen center width="lg" className="pt-16">
        {/* No subtitle. "Insert coin" was flavour text charging a line of
            height for nothing, and the mark says what it was gesturing at
            better than the words did. Wordmark's own <p> carried the mt-5, so
            the gap below is this wrapper's now. */}
        <ArcadeMark className="mx-auto mb-4" />
        <Wordmark size="md" className="mb-8">
          AniArcade
        </Wordmark>

        {/* The only thing left of the old full-width profile card. It points at
            the corner once and then never appears again. */}
        {!activeProfile && (
          <p className="mb-6 text-center text-sm text-white/40">
            No profile yet — tap 👤 up top to set one up.
          </p>
        )}

        {/* The board. Up to six across, so the roster reads at a glance instead
            of running off the bottom — a stacked column was already scrolling at
            six games and the registry is still growing. lg: is the app's first,
            deliberately: sm: and lg: are the two widths where another column
            earns its keep.

            Six rather than four is what keeps the accent panel from being mostly
            paint. The icons are square and the panel is 4:3, so growing the icon
            can never fill the sides — the panel has to come IN to meet it, which
            means a narrower tile. The ladder is picked so the tile stays roughly
            136–155px at every breakpoint instead of ballooning on desktop, which
            is why the icon below needs no responsive size. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
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
