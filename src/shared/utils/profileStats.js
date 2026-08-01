// Pure helpers behind the hub profile picker.
//
// These live in a .js module rather than inside the picker component on
// purpose: vite.config.js only runs `src/**/*.test.js` under environment
// 'node', so anything that lands in a .jsx file cannot be covered by the suite
// as it is configured today.

// The profile id IS the name, folded — there is no separate id space. Both the
// storage layer (loadOrCreateProfile) and the picker call this, so they can
// never disagree about which typed name maps to which saved profile. That
// disagreement is the whole bug the picker exists to kill: "Caden " and "caden"
// fold together, but "Cadenn" is a brand new empty profile that looks exactly
// like a lost import.
export function profileIdFromName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

// Both counts tolerate a half-shaped profile. normalizeProfile repairs anything
// that comes out of storage, but the picker also renders profiles mid-import
// and mid-merge, before that pass has run over them.
export function countShows(profile) {
  return (profile?.animeList ?? []).length;
}

export function countCharacters(profile) {
  return (profile?.animeList ?? []).reduce(
    (sum, anime) => sum + (anime?.characters ?? []).length,
    0
  );
}

// Cheap change-detector for "does the room's copy of me still match my profile?".
//
// Online, the profile store is the source of truth and the room copy is derived,
// so a lobby has to notice a local edit and republish it. Object identity is no
// use — the provider hands out a fresh map on every save, including saves to
// *other* profiles — and a deep compare is real work, because an imported
// animeList runs to hundreds of KB.
//
// Every AniList import moves at least one of these numbers, which is the case
// that matters. The gap: a ListManager edit that renames a character without
// changing any count reads as unchanged and won't republish. That is exactly the
// staleness online play already had, so it costs nothing new — but it is the
// reason this is a fingerprint and not an equality check.
export function profileFingerprint(profile) {
  if (!profile) return '';
  return [
    profile.id ?? '',
    profile.name ?? '',
    countShows(profile),
    countCharacters(profile),
    (profile.anilistImportedIds ?? []).length,
  ].join('|');
}

// One row per profile, ordered most-useful-first: whoever is active, then most
// recently played, then everyone else alphabetically. The name tiebreak matters
// — without it two profiles that have never been used (lastUsedAt 0) would sort
// by object key order and jitter between renders.
export function summarizeProfiles(profiles, activeId = null) {
  return Object.values(profiles ?? {})
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      shows: countShows(profile),
      characters: countCharacters(profile),
      lastUsedAt: profile.lastUsedAt ?? 0,
      isActive: profile.id === activeId,
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.lastUsedAt !== b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
      return a.name.localeCompare(b.name);
    });
}

// Which profile the app should open as. A stored active id can point at a
// profile that has since been deleted (or at a browser whose storage was
// cleared for one key and not the other), so this never trusts it blindly.
// Falling back to the richest profile beats falling back to "none": a returning
// player almost always wants the list they actually built.
export function resolveActiveProfileId(profiles, storedId) {
  const all = profiles ?? {};
  if (storedId && all[storedId]) return storedId;

  const ranked = summarizeProfiles(all);
  if (ranked.length === 0) return null;
  const richest = ranked.reduce((best, p) => (p.characters > best.characters ? p : best), ranked[0]);
  return richest.id;
}
