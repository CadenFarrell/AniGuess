import { storage } from '../services/storage';

const SESSION_KEY = 'aniguess_session';

export function useGameSession() {
  const saveSession = (sessionData) => {
    storage.setItem(SESSION_KEY, sessionData);
  };

  const loadSession = () => {
    return storage.getItem(SESSION_KEY);
  };

  const clearSession = () => {
    storage.removeItem(SESSION_KEY);
  };

  return { saveSession, loadSession, clearSession };
}