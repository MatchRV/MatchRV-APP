import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';

import { canShowPreviewBypass } from '@/lib/auth/gate';
import { firebaseStatus, getFirebaseAuth } from '@/lib/firebase/app';

interface AuthState {
  user: User | null;
  /** True until Firebase restores (or rules out) a persisted session. */
  initializing: boolean;
  /** False => Firebase env config is missing, so nobody can sign in in this build. */
  firebaseReady: boolean;
  firebaseError: string | null;
  /** Whether the dev-only "Preview without sign-in" link may be shown / used. */
  previewAllowed: boolean;
  /** In-memory only (never persisted): browsing past the welcome gate without an account. */
  previewMode: boolean;
  startPreview: () => void;
  /** Leaves preview mode, which sends the user back to the welcome / sign-in screen. */
  exitPreview: () => void;
  signOut: () => Promise<void>;
  /**
   * Returns the uid when signed in. Otherwise (preview mode) explains that an account is
   * required and offers to go to the sign-in screen, then returns null.
   */
  requireSignIn: (reason: string) => string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const providersLabel = Platform.OS === 'ios' ? 'Google or Apple' : 'Google';

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useMemo(() => firebaseStatus(), []);
  const auth = getFirebaseAuth();
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [initializing, setInitializing] = useState(auth != null);
  const [previewMode, setPreviewMode] = useState(false);
  const previewAllowed = canShowPreviewBypass({ isDev: __DEV__, firebaseConfigured: status.configured });

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setPreviewMode(false);
      setInitializing(false);
    });
  }, [auth]);

  const startPreview = useCallback(() => {
    // Enforced here too, so the bypass is unreachable in production even if a caller misbehaves.
    if (previewAllowed) setPreviewMode(true);
  }, [previewAllowed]);
  const exitPreview = useCallback(() => setPreviewMode(false), []);

  const signOut = useCallback(async () => {
    setPreviewMode(false);
    if (auth) await fbSignOut(auth);
  }, [auth]);

  const requireSignIn = useCallback(
    (reason: string) => {
      if (user) return user.uid;
      if (!status.configured) {
        Alert.alert(
          'Sign-in required',
          `${reason} needs a MatchRV account, but sign-in isn't configured in this build (Firebase env config is missing).`,
        );
        return null;
      }
      Alert.alert(
        'Sign-in required',
        `${reason} needs a free MatchRV account. Sign in with ${providersLabel} to save RVs, get price-drop alerts, and contact dealers.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => setPreviewMode(false) },
        ],
      );
      return null;
    },
    [user, status.configured],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      firebaseReady: status.configured,
      firebaseError: status.error,
      previewAllowed,
      previewMode,
      startPreview,
      exitPreview,
      signOut,
      requireSignIn,
    }),
    [user, initializing, status, previewAllowed, previewMode, startPreview, exitPreview, signOut, requireSignIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
