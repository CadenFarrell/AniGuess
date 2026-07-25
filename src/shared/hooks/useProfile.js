import { useCallback } from 'react';
import { storage } from '../services/storage';
import { normalizeCharacter } from '../utils/character';
import { dedupeProfileAnimeList } from '../utils/profileMerge';

const PROFILES_KEY = 'aniguess_profiles';

// Runs on every read, so profiles saved before franchise grouping existed get
// their duplicate entries collapsed without a migration flag — and the repair
// persists on its own the next time saveProfile writes the profile back.
function normalizeProfile(profile) {
  return {
    ...profile,
    animeList: dedupeProfileAnimeList(
      profile.animeList.map((anime) => ({
        ...anime,
        characters: anime.characters.map(normalizeCharacter),
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
    const id = trimmed.toLowerCase().replace(/\s+/g, '_');
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

  return { loadOrCreateProfile, saveProfile, getAllProfiles };
}