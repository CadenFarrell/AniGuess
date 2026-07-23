import { computeRankedPlayers, getPositionEmoji } from '../../../shared/utils/ranking';

export default function AniTuneResults({ players, scores, roundSize, onPlayAgain, onExit }) {
  const ranked = computeRankedPlayers(players, scores);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-3">🏆</div>
        <h1 className="text-4xl font-black text-white mb-8">Final Scores</h1>

        <div className="bg-white/5 rounded-xl overflow-hidden mb-8">
          {ranked.map((p) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0">
              <span className="text-2xl w-10">{getPositionEmoji(p.position)}</span>
              <span className="text-white font-bold text-lg flex-1 text-left">{p.name}</span>
              <span className="text-white/60">
                {p.total} / {roundSize}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onPlayAgain}
          className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-lg rounded-xl mb-3"
        >
          🔁 Play again
        </button>
        <button onClick={onExit} className="w-full text-white/60 hover:text-white transition-colors">
          ← Back to hub
        </button>
      </div>
    </div>
  );
}
