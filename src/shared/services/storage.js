export const storage = {
  getItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  // Returns false when the write did not stick, so a caller holding data the
  // user would hate to lose — a freshly imported profile — can say so on screen.
  //
  // Two failure modes, and the second is why this reads back rather than only
  // catching: a full quota throws QuotaExceededError, but a write can also
  // simply not persist. Swallowing either meant an AniList import could vanish
  // on the next reload with the UI still showing that it saved.
  //
  // The comparison is on the raw string. Re-parsing would cost more than the
  // write did — the profile map is already several hundred KB.
  setItem(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      if (localStorage.getItem(key) !== serialized) {
        console.error(`localStorage did not persist "${key}"`);
        return false;
      }
      return true;
    } catch {
      console.error('localStorage unavailable');
      return false;
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      console.error('localStorage unavailable');
    }
  },

  // Every key currently stored. Only the crash reset needs this — it has to
  // clear game state it cannot enumerate, since a game added later brings keys
  // no existing code knows the names of. See shared/utils/resetKeys.js.
  keys() {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  }
};