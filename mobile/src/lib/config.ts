// Runtime configuration. EXPO_PUBLIC_* vars are inlined at bundle time by Expo
// (they must be referenced statically as process.env.EXPO_PUBLIC_NAME).
import { DEFAULT_MCP_ENDPOINT } from './mcp/client';

const clean = (v: string | undefined) => (v && v.trim().length > 0 ? v.trim() : undefined);

export const firebaseWebConfig = {
  apiKey: clean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

export const config = {
  mcpUrl: clean(process.env.EXPO_PUBLIC_MCP_URL) ?? DEFAULT_MCP_ENDPOINT,
  /** Named Firestore database (the Kotlin app uses a non-default database id). */
  firestoreDatabaseId: clean(process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID),
  /** Same default model name as AskAiRepository.kt. */
  geminiModel: clean(process.env.EXPO_PUBLIC_GEMINI_MODEL) ?? 'gemini-3.8-flash',
  google: {
    webClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    iosClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    androidClientId: clean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  },
};

/** Firebase is usable only when the minimum web config is present. */
export const isFirebaseConfigured = Boolean(
  firebaseWebConfig.apiKey && firebaseWebConfig.projectId && firebaseWebConfig.appId,
);
