// The persistent way home. Fixed top-left on every in-game screen so no flow
// can dead-end; the online shell's room code and Leave live at top-right, so
// the two never collide.
//
// Labelled "🏠 Hub" rather than "← Hub" on purpose — several screens have
// their own in-flow "← Back", and two arrow-prefixed controls stacked on top
// of each other read as the same button.

// `confirm`, when set, is the message to guard the exit with — used while a
// game is actually in progress. Same window.confirm pattern the online Leave
// button already uses.
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
