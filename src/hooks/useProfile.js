import { useCallback } from 'react';
import { storage } from '../services/storage';
import { normalizeCharacter } from '../utils/character';

const PROFILES_KEY = 'aniguess_profiles';

function normalizeProfile(profile) {
  return {
    ...profile,
    animeList: profile.animeList.map((anime) => ({
      ...anime,
      characters: anime.characters.map(normalizeCharacter),
    })),
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