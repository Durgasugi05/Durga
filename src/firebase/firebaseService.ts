import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  User,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove,
  get,
  Database,
  Unsubscribe,
} from 'firebase/database';
import {
  AccountRole,
  FirebaseConfigOptions,
  FirebaseGameState,
  FirebaseQuestion,
  HostGameState,
  Question,
  TeamGameState,
  TeamId,
  TeamSubmission,
  TimerState,
  UserSession,
} from '../types';
import { getActiveFirebaseConfig, isFirebaseConfigured } from './config';

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  mode: 'FIREBASE_REALTIME_DB' | 'SERVER_REALTIME_DB';
  projectId?: string;
  databaseUrl?: string;
  error?: string | null;
}

// Official Account Definitions (Passwords are never stored in client code)
export const OFFICIAL_ACCOUNTS: Array<{
  id: string;
  role: AccountRole;
  teamId?: TeamId;
  email: string;
  displayName: string;
}> = [
  {
    id: 'account-host',
    role: 'HOST',
    email: 'host@opsfortune.mba',
    displayName: 'Event Host',
  },
  {
    id: 'account-hr',
    role: 'TEAM',
    teamId: 'HR',
    email: 'hr@opsfortune.mba',
    displayName: 'HR',
  },
  {
    id: 'account-marketing',
    role: 'TEAM',
    teamId: 'Marketing',
    email: 'marketing@opsfortune.mba',
    displayName: 'Marketing',
  },
  {
    id: 'account-finance',
    role: 'TEAM',
    teamId: 'Finance',
    email: 'finance@opsfortune.mba',
    displayName: 'Finance',
  },
  {
    id: 'account-ai',
    role: 'TEAM',
    teamId: 'AI',
    email: 'ai@opsfortune.mba',
    displayName: 'AI',
  },
];

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Database | null = null;

export function getFirebaseInstances(): {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Database | null;
} {
  if (appInstance && authInstance && dbInstance) {
    return { app: appInstance, auth: authInstance, db: dbInstance };
  }

  const config = getActiveFirebaseConfig();
  if (config.apiKey && config.databaseURL) {
    try {
      const apps = getApps();
      appInstance = apps.length > 0 ? apps[0] : initializeApp(config);
      authInstance = getAuth(appInstance);
      dbInstance = getDatabase(appInstance);
      return { app: appInstance, auth: authInstance, db: dbInstance };
    } catch (err) {
      console.warn('Firebase initialization note:', err);
    }
  }

  return { app: null, auth: null, db: null };
}

export function getConnectionStatus(): FirebaseConnectionStatus {
  const configured = isFirebaseConfigured();
  const config = getActiveFirebaseConfig();
  const instances = getFirebaseInstances();

  return {
    isConfigured: configured,
    isConnected: Boolean(instances.db),
    mode: configured && instances.db ? 'FIREBASE_REALTIME_DB' : 'SERVER_REALTIME_DB',
    projectId: config.projectId,
    databaseUrl: config.databaseURL,
  };
}
