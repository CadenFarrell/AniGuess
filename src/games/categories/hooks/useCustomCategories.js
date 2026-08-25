import { useCallback, useState } from 'react';
import { storage } from '../../../shared/services/storage';
import { normalizeCustomCategory } from '../categories';

// The categories a player has written, kept on this device. A line-for-line port
// of games/wavelength/hooks/useCustomSpectra.js, which was itself a port of
// anirank's useCustomPrompts — one key holding the whole collection, every read
// normalized so an entry saved by an older build is repaired without a migration
// flag, and nothing touching localStorage except shared/services.
//
// Per-game key, matching anitag_online_room. "Wears glasses" means nothing to
// AniWave, and the convention is `<game>_*` for anything not shared across the
// arcade.
const CATEGORIES_KEY = 'anitag_custom_categories';

function load() {
  const raw = storage.getItem(CATEGORIES_KEY);
  if (!Array.isArray(raw)) return [];
  // normalizeCustomCategory returns null for an entry with no label, which is
  // exactly the entry that would deal somebody a turn with nothing to induce.
  // Dropping it here is the repair; the next write persists it.
  return raw.map(normalizeCustomCategory).filter(Boolean);
}

/**
 * { categories, saveCategory, deleteCategory } over that key.
 *
 * Deliberately NOT a context provider, for the reason useCustomPrompts
 * documents: its consumers — the setup screen and the online lobby — are never
 * mounted at the same time, so there is no second live copy to drift.
 * (ProfileProvider.jsx covers the case where there is.)
 */
export function useCustomCategories() {
  const [categories, setCategories] = useState(load);

  // Upsert by id, so the editor's save path is the same whether it is creating
  // or editing. Returns the stored shape: the caller needs it to select the
  // category it just wrote, and normalize may have changed what it handed in.
  const saveCategory = useCallback((draft) => {
    const saved = normalizeCustomCategory(draft);
    if (!saved) return null;
    setCategories((prev) => {
      const i = prev.findIndex((c) => c.id === saved.id);
      const next = i >= 0
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [...prev, saved];
      // Inside the updater, so what persists is the same array React commits.
      storage.setItem(CATEGORIES_KEY, next);
      return next;
    });
    return saved;
  }, []);

  const deleteCategory = useCallback((id) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.id !== id);
      storage.setItem(CATEGORIES_KEY, next);
      return next;
    });
  }, []);

  return { categories, saveCategory, deleteCategory };
}
