// Shown on every device during 'game' phase except the current guesser's.
// Resolves pending questions via a button click (guesses are auto-resolved
// by OnlineGame, since there's nothing for a human to decide).
export default function OnlineAnswererView({ guesser, pendingAction, onAnswer, resolving }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md">
        <div className="text-6xl mb-4">⏳</div>
        <h2 className="text-3xl font-black text-white mb-6">{guesser?.name}'s Turn</h2>

        {(!pendingAction || pendingAction.resolved) && (
          <p className="text-white/50 text-lg">Waiting for a question or guess…</p>
        )}

        {pendingAction && !pendingAction.resolved && pendingAction.kind === 'question' && (
          <>
            <p className="text-white text-xl font-bold mb-6">❓ {pendingAction.text}</p>
            <div className="flex gap-4">
              <button
                onClick={() => onAnswer('Yes')}
                disabled={resolving}
                className="flex-1 py-6 text-2xl font-black bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 disabled:opacity-50 text-white rounded-xl transition-all"
              >
                ✅ Yes
              </button>
              <button
                onClick={() => onAnswer('No')}
                disabled={resolving}
                className="flex-1 py-6 text-2xl font-black bg-gradient-to-br from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 disabled:opacity-50 text-white rounded-xl transition-all"
              >
                ❌ No
              </button>
            </div>
          </>
        )}

        {pendingAction && !pendingAction.resolved && pendingAction.kind === 'guess' && (
          <p className="text-white/60 text-lg">🎯 Checking guess: "{pendingAction.text}"…</p>
        )}
      </div>
    </div>
  );
}
