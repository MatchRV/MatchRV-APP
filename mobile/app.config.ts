// MatchRV Expo config. All Firebase / OAuth values come from env (see .env.example);
// EXPO_PUBLIC_* values are read directly in src/lib/config.ts and inlined at bundle time.
import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Optional native Firebase files — referenced only if the path is set AND the file exists. */
function optionalFile(envVar: string | undefined): string | undefined {
  if (!envVar) return undefined;
  // Node built-ins via require so the app tsconfig doesn't need @types/node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as { existsSync(path: string): boolean };
  return fs.existsSync(envVar) ? envVar : undefined; // relative to the project root (cwd)
}

// Bundle id / package are pending owner confirmation (see README).
const APP_ID = 'com.matchrv.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MatchRV',
  slug: 'matchrv',
  scheme: 'matchrv',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#040B12',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: true,
    // Sign in with Apple capability (App Store guideline 4.8: required because Google sign-in is offered).
    usesAppleSignIn: true,
    googleServicesFile: optionalFile(process.env.GOOGLE_SERVICE_INFO_PLIST),
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: APP_ID,
    adaptiveIcon: {
      foregroundImage: './assets/images/icon.png',
      backgroundColor: '#040B12',
    },
    googleServicesFile: optionalFile(process.env.GOOGLE_SERVICES_JSON),
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#040B12',
        image: './assets/images/logo-transparent.png',
        imageWidth: 220,
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    [
      'expo-notifications',
      {
        color: '#2DE2D2',
        // Local notifications only — no push server, so no APNs entitlement is needed.
        enableRemoteNotifications: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Non-secret flags for diagnostics; real config is read from EXPO_PUBLIC_* at bundle time.
    firebaseConfigured: Boolean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY && process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  },
});
