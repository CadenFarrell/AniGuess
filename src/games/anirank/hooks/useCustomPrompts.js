import { useCallback, useState } from 'react';
import { storage } from '../../../shared/services/storage';
import { normalizeCustomPrompt } from '../axes';

// The prompts a player has written, kept on this device. Modelled on
// shared/hooks/useProfile.js: one key holding the whole collection, every read
// normalized so an entry saved by an older build is repaired without a
// migration flag, and nothing touching localStorage except shared/services.
//
// Per-game key, matching anirank_online_room — a prompt about ranking shows
// means nothing to AniGuess, and the naming convention is `<game>_*` for
// anything that is not shared across the arcade.
const PROMPTS_KEY = 'anirank_custom_prompts';

function load() {
  const raw = storage.getItem(PROMPTS_KEY);
  if (!Array.isArray(raw)) return [];
  // normalizeCustomPrompt returns null for an entry with no usable text, which
  // is exactly the entry that would otherwise render a nameless mode and a blank
  // board. Dropping it here is the repair; the next write persists it.
  return raw.map(normalizeCustomPrompt).filter(Boolean);
}

/**
 * { prompts, savePrompt, deletePrompt } over that key.
 *
 * Deliberately NOT a context provider, unlike profiles: the local setup screen
 * and the online lobby are the only two consumers and are never mounted at the
 * same time, so there is no second live copy to drift. (ProfileProvider.jsx
 * documents the case where there is — one profile shown on several screens at
 * once, where a bare storage write re-renders nothing.)
 */
export function useCustomPrompts() {
  const [prompts, setPrompts] = useState(load);

  // Upsert by id, so the editor's save path is the same whether it is creating
  // or editing. Returns the stored shape: the caller needs it to select the
  // prompt it just wrote, and normalize may have changed what it handed in.
  const savePrompt = useCallback((draft) => {
    const saved = normalizeCustomPrompt(draft);
    if (!saved) return null;
    setPrompts((prev) => {
      const i = prev.findIndex((p) => p.id === saved.id);
      const next = i >= 0
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved];
      storage.setItem(PROMPTS_KEY, next);
      return next;
    });
    return saved;
  }, []);

  const deletePrompt = useCallback((id) => {
    setPrompts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      storage.setItem(PROMPTS_KEY, next);
      return next;
    });
  }, []);

  return { prompts, savePrompt, deletePrompt };
}
