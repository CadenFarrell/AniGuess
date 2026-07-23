import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Online mode is only available when the app has been configured with a real
// (or emulator) Firebase project. With no .env.local, this stays false and
// nothing below ever touches the network — local pass-and-play mode has zero
// Firebase dependency.
export const firebaseEnabled = Boolean(config.apiKey && config.databaseURL);

let app = null;
let auth = null;
let db = null;

function ensureInitialized() {
  if (!firebaseEnabled) {
    throw new Error('Firebase is not configured (missing VITE_FIREBASE_* env vars).');
  }
  if (app) return;

  app = initializeApp(config);
  auth = getAuth(app);
  db = getDatabase(app);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
}

export function getFirebaseAuth() {
  ensureInitialized();
  return auth;
}

export function getFirebaseDb() {
  ensureInitialized();
  return db;
}

// Signs this device in anonymously (idempotent — Firebase persists the
// anonymous uid across reloads via IndexedDB) and resolves with the uid.
export function ensureSignedIn() {
  const authInstance = getFirebaseAuth();
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      unsubscribe();
      if (user) {
        resolve(user.uid);
      } else {
        signInAnonymously(authInstance)
          .then((cred) => resolve(cred.user.uid))
          .catch(reject);
      }
    }, reject);
  });
}
