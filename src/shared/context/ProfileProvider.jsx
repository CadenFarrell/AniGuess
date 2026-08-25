import { useCallback, useMemo, useRef, useState } from 'react';
import { Banner } from '../ui';
import { useProfile } from '../hooks/useProfile';
import { resolveActiveProfileId } from '../utils/profileStats';
import { ProfileContext } from './profileContext';

// The single owner of profile state for the whole app.
//
// useProfile() on its own is stateless — every consumer re-reads localStorage
// independently, so a profile edited in one component never re-renders any
// other. That was invisible while each screen asked for a name and used only
// its own answer; it is fatal once the hub picks one profile that every game
// inherits. So: one provider holds the map, and every write goes through it.
//
// Consumers therefore import useProfileStore, not useProfile. useProfile is now
// the storage layer underneath this file.
export default function ProfileProvider({ children }) {
  const {
    getAllProfiles,
    loadOrCreateProfile,
    saveProfile: persistProfile,
    deleteProfile: purgeProfile,
    getActiveProfileId,
    setActiveProfileId: persistActiveId,
  } = useProfile();

  const [profiles, setProfiles] = useState(() => getAllProfiles());
  const [activeId, setActiveId] = useState(() =>
    resolveActiveProfileId(getAllProfiles(), getActiveProfileId())
  );

  // Set when a write to localStorage did not stick. Held here rather than in
  // whichever screen triggered the save, because the write that matters most —
  // an AniList import — is worth hours, and the player may well have navigated
  // away from the import screen before the failure would otherwise show.
  const [storageError, setStorageError] = useState(false);

  // The map as of the last write, not as of the last render.
  //
  // This ref is load-bearing, not an optimisation. Two writes in one event
  // handler — say `saveProfile(merged); selectProfile(id)` — both close over the
  // same render's `profiles`. Without the ref the second call reads the stale
  // pre-merge profile, re-stamps it, and persists it back over the first write,
  // silently throwing away everything the merge just added.
  const profilesRef = useRef(profiles);

  const commitProfiles = useCallback((next) => {
    profilesRef.current = next;
    setProfiles(next);
  }, []);

  const saveProfile = useCallback((profile) => {
    const persisted = persistProfile(profile);
    setStorageError(!persisted);
    // Committed either way, deliberately: a profile that failed to persist is
    // still the right thing to show for the rest of this session, and dropping
    // it here would lose the data twice over.
    commitProfiles({ ...profilesRef.current, [profile.id]: profile });
    return persisted;
  }, [persistProfile, commitProfiles]);

  // Stamping lastUsedAt here (rather than at game start) is what orders the
  // picker: the profile you actually play with floats to the top on its own,
  // with no separate "recents" list to keep in sync.
  const selectProfile = useCallback((id) => {
    setActiveId(id);
    persistActiveId(id);
    const profile = profilesRef.current[id];
    if (!profile) return;
    const stamped = { ...profile, lastUsedAt: Date.now() };
    persistProfile(stamped);
    commitProfiles({ ...profilesRef.current, [id]: stamped });
  }, [persistActiveId, persistProfile, commitProfiles]);

  // Load-or-create *without* touching who is active. The pass-and-play setup
  // screens use this: adding your friend to a local game must not make the hub
  // decide your friend is you.
  const ensureProfile = useCallback((name) => {
    const { profile, isNew } = loadOrCreateProfile(name);
    commitProfiles({ ...profilesRef.current, [profile.id]: profile });
    return { profile, isNew };
  }, [loadOrCreateProfile, commitProfiles]);

  // Returns the profile either way — an existing one if the name folds onto it,
  // which is exactly the near-miss case the picker exists to prevent. Callers
  // can tell the difference from `isNew` if they need to.
  const createProfile = useCallback((name) => {
    const { profile, isNew } = loadOrCreateProfile(name);
    const stamped = { ...profile, lastUsedAt: Date.now() };
    persistProfile(stamped);
    commitProfiles({ ...profilesRef.current, [stamped.id]: stamped });
    setActiveId(stamped.id);
    persistActiveId(stamped.id);
    return { profile: stamped, isNew };
  }, [loadOrCreateProfile, persistProfile, persistActiveId, commitProfiles]);

  const removeProfile = useCallback((id) => {
    purgeProfile(id);
    const next = { ...profilesRef.current };
    delete next[id];
    // Re-resolve rather than clearing: deleting whoever was active should land
    // on the next best profile, not on "no profile selected".
    const nextActive = resolveActiveProfileId(next, activeId === id ? null : activeId);
    commitProfiles(next);
    setActiveId(nextActive);
    persistActiveId(nextActive);
  }, [purgeProfile, activeId, persistActiveId, commitProfiles]);

  const value = useMemo(() => ({
    profiles,
    activeId,
    activeProfile: activeId ? profiles[activeId] ?? null : null,
    selectProfile,
    createProfile,
    ensureProfile,
    saveProfile,
    removeProfile,
  }), [profiles, activeId, selectProfile, createProfile, ensureProfile, saveProfile, removeProfile]);

  return (
    <ProfileContext.Provider value={value}>
      {storageError && (
        <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-2xl p-3">
          <Banner tone="danger" onDismiss={() => setStorageError(false)}>
            <strong className="font-black">Your profile did not save.</strong>{' '}
            Browser storage is full or blocked, so anything you just imported
            will be gone when you reload. Deleting a profile you no longer use
            frees space.
          </Banner>
        </div>
      )}
      {children}
    </ProfileContext.Provider>
  );
}
