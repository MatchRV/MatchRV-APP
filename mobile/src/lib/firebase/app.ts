// Firebase JS SDK bootstrap. Returns nulls (browse-only mode) when env config is missing.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

import { config, firebaseWebConfig, isFirebaseConfigured } from '../config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let initError: string | null = null;

function init() {
  if (app || initError || !isFirebaseConfigured) return;
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseWebConfig);
    try {
      auth =
        Platform.OS === 'web'
          ? getAuth(app)
          : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // initializeAuth throws if already initialized (fast refresh)
      auth = getAuth(app);
    }
    const dbId = config.firestoreDatabaseId;
    try {
      // Long polling is the reliable transport for Firestore's WebChannel in React Native.
      db = dbId
        ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
        : initializeFirestore(app, { experimentalForceLongPolling: true });
    } catch {
      db = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }
  } catch (e) {
    initError = e instanceof Error ? e.message : 'Firebase failed to initialize';
    app = null;
    auth = null;
    db = null;
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  init();
  return app;
}
export function getFirebaseAuth(): Auth | null {
  init();
  return auth;
}
export function getDb(): Firestore | null {
  init();
  return db;
}
export function firebaseStatus(): { configured: boolean; error: string | null; usingNamedDatabase: boolean } {
  init();
  return { configured: isFirebaseConfigured && !initError, error: initError, usingNamedDatabase: !!config.firestoreDatabaseId };
}
