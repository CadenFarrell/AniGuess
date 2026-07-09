import { useCallback } from 'react';
import { storage } from '../services/storage';

const SESSION_KEY = 'aniguess_session';

export function useGameSession() {
  const saveSession = useCallback((sessionData) => {
    storage.setItem(SESSION_KEY, sessionData);
  }, []);

  const loadSession = useCallback(() => {
    return storage.getItem(SESSION_KEY);
  }, []);

  const clearSession = useCallback(() => {
    storage.removeItem(SESSION_KEY);
  }, []);

  return { saveSession, loadSession, clearSession };
}