import { getPositionEmoji } from '../../../shared/utils/ranking';

export default function CorrectGuessScreen({ lastLocked, lockedPositions, onContinue }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center w-full">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-9xl mb-6">🎉</div>
        <h2 className="text-5xl font-black text-white mb-3">{lastLocked.name} got it!</h2>
        <p className="text-7xl font-black mb-3">
          {lastLocked.position <= 3 && getPositionEmoji(lastLocked.position)}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500">
            {lastLocked.position === 1 ? ' 1st' :
             lastLocked.position === 2 ? ' 2nd' :
             lastLocked.position === 3 ? ' 3rd' :
             `#${lastLocked.position}`}
          </span>
        </p>
        <p className="text-2xl text-white/60 mb-3">in {lastLocked.turnsUsed} turns</p>
        {lockedPositions.filter(lp => lp.turnsUsed === lastLocked.turnsUsed && lp.playerId !== lastLocked.playerId).length > 0 && (
          <p className="text-yellow-400 font-bold text-xl mb-3">🤝 Tied!</p>
        )}
        <p className="text-3xl text-green-400 font-bold mb-10">+{lastLocked.points} points</p>
        <button
          onClick={onContinue}
          className="w-full py-5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-2xl rounded-xl transition-all"
        >
          Continue Game →
        </button>
      </div>
    </div>
  );
}
