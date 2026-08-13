// The persistent way home. Fixed top-left on every in-game screen — including
// each game's local/online menu — so no flow can dead-end and the exit never
// moves between views. The online shell's room code and Leave live at
// top-right, so the two never collide.
//
// Render it ONCE per flow, at the game root (`<Game>Game.jsx` for the menu,
// `LocalGame.jsx` for local play, `shell()` for a room) — never per screen.
// Rendering it per screen is what let AniRank wire the round's copy to its
// back-to-setup handler, so a button reading "🏠 Hub" returned to setup for a
// release; it is also why AniFake's pass-and-play screens had no exit at all,
// since each new screen had to remember to add one. A root button covers every
// screen the router can reach, including the ones nobody thought about.
//
// The hub's own list editor uses it too (HubScreen.jsx), where "Hub" is literal:
// that view is inside the hub, so leaving it lands on the menu.
//
// Labelled "🏠 Hub" rather than "← Hub" on purpose — several screens have
// their own in-flow "← Back" (AniRank's "← Quit round", AniFake's "← Leave the
// round", "← Back to setup" on the results screens), and two arrow-prefixed
// controls stacked on top of each other read as the same button. That is the
// division to keep: **Hub leaves the flow, "← Back" steps within it.** The
// stepping half is Screen's `onBack`/`backLabel` (shared/ui/Screen.jsx), which
// renders in-flow at the top of the column so it scrolls instead of competing
// with this fixed control.
//
// Do not generalise "← Back" into a global history button. There is no router,
// most screen sequences are derived rather than stored (see LocalRound.jsx), and
// reversing one would re-reveal a secret, undo a locked-in placement, or — online,
// where `view` is shared room state — rewind the round for every other player.
// Back-nav belongs on the specific screens where going back is provably safe.

// `confirm`, when set, is the message to guard the exit with — used only while a
// round is actually in progress, since setup and results have nothing to lose.
// Same window.confirm pattern the online Leave button already uses.
export default function HubButton({ onClick, confirm = null }) {
  const handleClick = () => {
    if (confirm && !window.confirm(confirm)) return;
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className="focus-pop fixed top-3 left-3 z-40 rounded-pop-sm bg-black/40 px-3 py-1.5
        font-display text-sm font-bold text-white/60 backdrop-blur-sm
        transition-colors hover:bg-black/60 hover:text-white"
    >
      🏠 Hub
    </button>
  );
}
