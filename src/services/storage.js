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
  }
};