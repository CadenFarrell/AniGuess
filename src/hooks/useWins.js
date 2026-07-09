import { useCallback } from 'react';
import { storage } from '../services/storage';

const WINS_KEY = 'aniGuessWins';

export function useWins() {
  const getWins = useCallback(() => storage.getItem(WINS_KEY) || {}, []);

  const recordWin = useCallback((playerName) => {
    const wins = storage.getItem(WINS_KEY) || {};
    wins[playerName] = (wins[playerName] || 0) + 1;
    storage.setItem(WINS_KEY, wins);
  }, []);

  const resetWins = useCallback(() => storage.removeItem(WINS_KEY), []);

  return { getWins, recordWin, resetWins };
}
