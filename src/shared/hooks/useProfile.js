import { useCallback } from 'react';
import { storage } from '../services/storage';
import { normalizeCharacter } from '../utils/character';
import { dedupeProfileAnimeList } from '../utils/profileMerge';
import { profileIdFromName } from '../utils/profileStats';

const PROFILES_KEY = 'aniguess_profiles';

// A new key, so it gets the current name. PROFILES_KEY above cannot be renamed
// to match — it predates the hub, and changing it would orphan every profile
// players have already saved.
const ACTIVE_PROFILE_KEY = 'aniarcade_active_profile';

// Runs on every read, so profiles saved before franchise grouping existed get
// their duplicate entries collapsed without a migration flag — and the repair
// persists on its own the next time saveProfile writes the profile back.
//
// The ?? [] guards are load-bearing now that the picker can surface *every*
// saved profile rather than just the one whose name was typed: a single profile
// stored without an animeList used to be invisible, and would now take the
// whole hub down on mount.
function normalizeProfile(profile) {
  return {
    ...profile,
    animeList: dedupeProfileAnimeList(
      (profile.animeList ?? []).map((anime) => ({
        ...anime,
        characters: (anime.characters ?? []).map(normalizeCharacter),
      }))
    ),
  };
}

export function useProfile() {
  const getAllProfiles = useCallback(() => {
    const profiles = storage.getItem(PROFILES_KEY) || {};
    return Object.fromEntries(
      Object.entries(profiles).map(([id, profile]) => [id, normalizeProfile(profile)])
    );
  }, []);

  const loadOrCreateProfile = useCallback((name) => {
    const trimmed = name.trim();
    const id = profileIdFromName(trimmed);
    const profiles = storage.getItem(PROFILES_KEY) || {};

    if (profiles[id]) {
      return { profile: normalizeProfile(profiles[id]), isNew: false };
    }

    const newProfile = {
      id,
      name: trimmed,
      animeList: []
    };

    profiles[id] = newProfile;
    storage.setItem(PROFILES_KEY, profiles);
    return { profile: newProfile, isNew: true };
  }, []);

  const saveProfile = useCallback((profile) => {
    const profiles = storage.getItem(PROFILES_KEY) || {};
    profiles[profile.id] = profile;
    storage.setItem(PROFILES_KEY, profiles);
  }, []);

  const deleteProfile = useCallback((id) => {
    const profiles = storage.getItem(PROFILES_KEY) || {};
    delete profiles[id];
    storage.setItem(PROFILES_KEY, profiles);
    // Deliberately does not clear ACTIVE_PROFILE_KEY. resolveActiveProfileId
    // already treats a dangling active id as "pick the best one instead", so
    // there is one place that decides rather than two that can disagree.
  }, []);

  const getActiveProfileId = useCallback(() => storage.getItem(ACTIVE_PROFILE_KEY) ?? null, []);

  const setActiveProfileId = useCallback((id) => {
    if (id) storage.setItem(ACTIVE_PROFILE_KEY, id);
    else storage.removeItem(ACTIVE_PROFILE_KEY);
  }, []);

  return {
    loadOrCreateProfile,
    saveProfile,
    deleteProfile,
    getAllProfiles,
    getActiveProfileId,
    setActiveProfileId,
  };
}
