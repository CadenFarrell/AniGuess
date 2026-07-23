// Placeholder so the hub has a second registry entry to render and the
// opening-quiz branch has an obvious place to land. Replace wholesale.
export default function AniTuneGame({ onExit }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md">
        <div className="text-6xl mb-4">🎵</div>
        <h1 className="text-4xl font-black text-white mb-3">AniTune</h1>
        <p className="text-white/60 text-lg mb-10">Not built yet.</p>
        <button
          onClick={onExit}
          className="text-white/60 hover:text-white transition-colors text-lg"
        >
          ← Back to hub
        </button>
      </div>
    </div>
  );
}
