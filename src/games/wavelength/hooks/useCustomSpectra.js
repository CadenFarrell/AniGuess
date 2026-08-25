import { useCallback, useState } from 'react';
import { storage } from '../../../shared/services/storage';
import { normalizeCustomSpectrum } from '../spectra';

// The spectra a player has written, kept on this device. A line-for-line port of
// games/anirank/hooks/useCustomPrompts.js — one key holding the whole
// collection, every read normalized so an entry saved by an older build is
// repaired without a migration flag, and nothing touching localStorage except
// shared/services.
//
// Per-game key, matching aniwave_online_room. "CURSED → WHOLESOME" means nothing
// to AniRank, and the convention is `<game>_*` for anything not shared across
// the arcade.
const SPECTRA_KEY = 'aniwave_custom_spectra';

function load() {
  const raw = storage.getItem(SPECTRA_KEY);
  if (!Array.isArray(raw)) return [];
  // normalizeCustomSpectrum returns null for an entry missing an end label,
  // which is exactly the entry that would render a dial with a blank cap.
  // Dropping it here is the repair; the next write persists it.
  return raw.map(normalizeCustomSpectrum).filter(Boolean);
}

/**
 * { spectra, saveSpectrum, deleteSpectrum } over that key.
 *
 * Deliberately NOT a context provider, for the reason useCustomPrompts documents:
 * its consumers — the setup screen, the online lobby, and the psychic's own
 * picker — are never mounted at the same time, so there is no second live copy
 * to drift. (ProfileProvider.jsx covers the case where there is.)
 */
export function useCustomSpectra() {
  const [spectra, setSpectra] = useState(load);

  // Upsert by id, so the editor's save path is the same whether it is creating
  // or editing. Returns the stored shape: the caller needs it to select the
  // spectrum it just wrote, and normalize may have changed what it handed in.
  const saveSpectrum = useCallback((draft) => {
    const saved = normalizeCustomSpectrum(draft);
    if (!saved) return null;
    setSpectra((prev) => {
      const i = prev.findIndex((s) => s.id === saved.id);
      const next = i >= 0
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved];
      // Inside the updater, so what persists is the same array React commits.
      storage.setItem(SPECTRA_KEY, next);
      return next;
    });
    return saved;
  }, []);

  const deleteSpectrum = useCallback((id) => {
    setSpectra((prev) => {
      const next = prev.filter((s) => s.id !== id);
      storage.setItem(SPECTRA_KEY, next);
      return next;
    });
  }, []);

  return { spectra, saveSpectrum, deleteSpectrum };
}
