import { storage } from '../services/storage';

const PROFILES_KEY = 'aniguess_profiles';

export function useProfile() {
  const getAllProfiles = () => {
    return storage.getItem(PROFILES_KEY) || {};
  };

  const loadOrCreateProfile = (name) => {
    const trimmed = name.trim();
    const id = trimmed.toLowerCase().replace(/\s+/g, '_');
    const profiles = getAllProfiles();

    if (profiles[id]) {
      return { profile: profiles[id], isNew: false };
    }

    const newProfile = {
      id,
      name: trimmed,
      animeList: []
    };

    profiles[id] = newProfile;
    storage.setItem(PROFILES_KEY, profiles);
    return { profile: newProfile, isNew: true };
  };

  const saveProfile = (profile) => {
    const profiles = getAllProfiles();
    profiles[profile.id] = profile;
    storage.setItem(PROFILES_KEY, profiles);
  };

  return { loadOrCreateProfile, saveProfile, getAllProfiles };
}