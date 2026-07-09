import { useState } from 'react';
import App from '../App';
import OnlineApp from './OnlineApp';
import { firebaseEnabled } from '../services/firebase';

export default function Root() {
  const [mode, setMode] = useState(null); // null | 'local' | 'online'

  if (mode === 'local') return <App />;
  if (mode === 'online') return <OnlineApp onBack={() => setMode(null)} />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-3">
          AniGuess
        </h1>
        <p className="text-white/60 text-lg mb-10">The anime character guessing game</p>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setMode('local')}
            className="w-full py-5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xl rounded-xl transition-all"
          >
            📱 Play on this device
          </button>
          <button
            onClick={() => firebaseEnabled && setMode('online')}
            disabled={!firebaseEnabled}
            title={!firebaseEnabled ? 'Online play requires Firebase configuration (see .env.local.example)' : ''}
            className="w-full py-5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xl rounded-xl transition-colors"
          >
            🌐 Play Online {!firebaseEnabled && '(not configured)'}
          </button>
        </div>
      </div>
    </div>
  );
}
