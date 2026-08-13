import { useCallback, useState } from 'react';
import { storage } from '../../../shared/services/storage';
import { normalizeList } from '../tiers';

// The tier lists saved on this device, modelled on useCustomPrompts: one key
// holding the whole collection, every read normalized so a list written by an
// older build is repaired with no migration flag, and nothing touches
// localStorage except shared/services/storage.
//
// Keyed by profile, because a tier list belongs to a person rather than to a
// session: { [profileId]: { [listId]: list } }.
//
// NOT a field on the profile object, and the reason is specific rather than
// tidiness. The online room stores a COPY of the whole profile in state/ at
// join (see CLAUDE.md), so a profile-resident tier list would be published to
// every member of every room, in every game, for nothing — and it would ride
// along in profileFingerprint's republish path too. A sibling key matches the
// anirank_custom_prompts precedent and the `<game>_*` naming convention.
const LISTS_KEY = 'anirank_tier_lists';

const EMPTY = {};

function load() {
  const raw = storage.getItem(LISTS_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [profileId, lists] of Object.entries(raw)) {
    if (!lists || typeof lists !== 'object') continue;
    out[profileId] = {};
    // Re-keyed by the normalized list's own id rather than trusting the map
    // key: normalizeList invents an id for an entry that lost one, and a map
    // whose key and value disagree would upsert into the wrong slot forever.
    for (const list of Object.values(lists)) {
      const fixed = normalizeList(list);
      out[profileId][fixed.id] = fixed;
    }
  }
  return out;
}

/**
 * Persists the collection and returns what was actually stored.
 *
 * storage.setItem swallows a QuotaExceededError with a console.error, so a
 * failed write is indistinguishable from a successful one from up here — and
 * aniguess_profiles already runs to several hundred KB on the same origin, so
 * this is a live risk rather than a theoretical one. Reading back and comparing
 * the list count is the cheapest honest check: it catches the quota case, the
 * private-browsing case, and a disabled-storage browser alike.
 */
function persist(next) {
  storage.setItem(LISTS_KEY, next);
  const back = storage.getItem(LISTS_KEY);
  const count = (blob) => Object.values(blob ?? {}).reduce((n, m) => n + Object.keys(m).length, 0);
  return count(back) === count(next);
}

/**
 * { byProfile, listsFor, saveList, deleteList, duplicateList, saveError }.
 *
 * `byProfile` is exposed whole rather than scoped to one profile because the
 * compare screen needs lists belonging to OTHER profiles on the device — that
 * is the entire point of comparing.
 *
 * Deliberately not a context provider, for the reason useCustomPrompts gives:
 * the picker, the builder and the compare screen are all under one TierMode and
 * share this one instance, so there is no second live copy to drift.
 */
export function useTierLists() {
  const [byProfile, setByProfile] = useState(load);
  // Null until a write fails. The screens render it as a banner: a tier list is
  // an hour of work, and losing it silently is the one failure worth shouting
  // about.
  const [saveError, setSaveError] = useState(null);

  const listsFor = useCallback(
    (profileId) => Object.values(byProfile[profileId] ?? EMPTY).sort((a, b) => b.updatedAt - a.updatedAt),
    [byProfile]
  );

  // Upsert by id, so creating and editing take the same path. Stamps updatedAt
  // here rather than at the call site: every caller would have to remember, and
  // the picker orders by it.
  const saveList = useCallback((profileId, list) => {
    if (!profileId || !list?.id) return null;
    const saved = normalizeList({ ...list, updatedAt: Date.now() });
    setByProfile((prev) => {
      const next = { ...prev, [profileId]: { ...prev[profileId], [saved.id]: saved } };
      setSaveError(persist(next) ? null : 'Could not save — this browser’s storage is full or blocked.');
      return next;
    });
    return saved;
  }, []);

  const deleteList = useCallback((profileId, listId) => {
    setByProfile((prev) => {
      const lists = { ...prev[profileId] };
      delete lists[listId];
      const next = { ...prev, [profileId]: lists };
      setSaveError(persist(next) ? null : 'Could not save — this browser’s storage is full or blocked.');
      return next;
    });
  }, []);

  // A copy under a new id, which is how someone forks "All-time" into "2024
  // only" without re-sorting two hundred cards. The name is suffixed rather
  // than left identical, because the picker lists them side by side.
  const duplicateList = useCallback((profileId, listId) => {
    const source = byProfile[profileId]?.[listId];
    if (!source) return null;
    return saveList(profileId, {
      ...source,
      id: `tl_${Date.now().toString(36)}`,
      name: `${source.name} copy`.trim(),
    });
  }, [byProfile, saveList]);

  return { byProfile, listsFor, saveList, deleteList, duplicateList, saveError };
}
