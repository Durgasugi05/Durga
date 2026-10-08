import { FirebaseConfigOptions } from '../types';

const STORAGE_KEY = 'ops_fortune_firebase_custom_config';

export function getStoredFirebaseConfig(): FirebaseConfigOptions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredFirebaseConfig(config: FirebaseConfigOptions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function getActiveFirebaseConfig(): FirebaseConfigOptions {
  const custom = getStoredFirebaseConfig();
  if (custom && custom.apiKey && custom.databaseURL) {
    return custom;
  }

  return {
    apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || '',
    authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || '',
    databaseURL: (import.meta.env.VITE_FIREBASE_DATABASE_URL as string) || '',
    projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
    storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || '',
    messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
    appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
  };
}

export function isFirebaseConfigured(): boolean {
  const cfg = getActiveFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.databaseURL);
}
