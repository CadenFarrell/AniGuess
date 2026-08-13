import { useCallback, useState } from 'react';
import { storage } from '../services/storage';
import { PREFS_KEY, mergePrefs, writePrefs } from '../utils/gamePrefs';

/**
 * The options a player last started this game with, on this device.
 *
 * Modelled on games/anirank/hooks/useCustomPrompts.js: one key holding the whole
 * collection, every read normalized so a blob written by an older build is
 * repaired without a migration flag, and nothing touching localStorage except
 * shared/services. Deliberately NOT a context provider, for the reason that file
 * documents — a game's setup screen and its online lobby are the only consumers
 * and are never mounted at the same time, so there is no second live copy to
 * drift. (ProfileProvider.jsx covers the case where there is.)
 *
 * `defaults` is the game's DEFAULT_PREFS and doubles as the schema: see
 * mergePrefs. It is read once, at mount, so a screen may pass a fresh object
 * literal without re-seeding itself on every render.
 *
 * @param {string} gameId matching the hub registry id, so one game's saved
 *   settings can never be read as another's
 * @param {object} defaults every option this game persists, at its literal default
 * @returns {{ prefs: object, savePrefs: (partial: object) => void, resetPrefs: () => void }}
 *   `prefs` is the stored settings folded onto the defaults — the object a screen
 *   seeds its useState calls from, not live state. Nothing here re-renders: the
 *   screen owns the values from mount onward, which is what makes a save at Start
 *   a plain write rather than a round trip.
 */
export function useGamePrefs(gameId, defaults) {
  // Frozen at mount, both of them, via useState initializers whose setters are
  // deliberately discarded. Re-reading storage mid-session would let a write from
  // this very screen flow back in and fight the state the player is editing;
  // re-reading `defaults` would make an inline literal a new schema every render.
  const [schema] = useState(defaults);
  const [prefs] = useState(() => mergePrefs(storage.getItem(PREFS_KEY)?.[gameId], defaults));

  // Called with only the keys the calling screen actually renders — writePrefs
  // merges rather than replaces, so the online lobby saving its subset cannot
  // wipe the options only the local screen offers.
  const savePrefs = useCallback((partial) => {
    storage.setItem(PREFS_KEY, writePrefs(storage.getItem(PREFS_KEY), gameId, partial, schema));
  }, [gameId, schema]);

  // Drops this game's slice entirely rather than writing the defaults into it, so
  // "reset" means the same thing as "never played": a default that changes in a
  // later build then reaches a player who reset, instead of being pinned by the
  // values that happened to be current the day they pressed the link.
  const resetPrefs = useCallback(() => {
    const all = storage.getItem(PREFS_KEY);
    if (!all || typeof all !== 'object') return;
    const next = { ...all };
    delete next[gameId];
    storage.setItem(PREFS_KEY, next);
  }, [gameId]);

  return { prefs, savePrefs, resetPrefs };
}
