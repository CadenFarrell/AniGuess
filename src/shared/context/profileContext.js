import { createContext, useContext } from 'react';

// Split from ProfileProvider.jsx so that file exports only its component —
// react-refresh's only-export-components rule (eslint.config.js pulls in
// reactRefresh.configs.vite) flags a hook exported alongside a component.
export const ProfileContext = createContext(null);

export function useProfileStore() {
  const store = useContext(ProfileContext);
  if (!store) {
    throw new Error('useProfileStore must be used inside <ProfileProvider>');
  }
  return store;
}
