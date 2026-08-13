export const storage = {
  getItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.error('localStorage unavailable');
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