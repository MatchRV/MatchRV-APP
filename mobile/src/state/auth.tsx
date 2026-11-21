import { router } from 'expo-router';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { firebaseStatus, getFirebaseAuth } from '@/lib/firebase/app';

interface AuthState {
  user: User | null;
  initializing: boolean;
  /** False => browse-only mode (no Firebase env config). */
  firebaseReady: boolean;
  firebaseError: string | null;
  signOut: () => Promise<void>;
  /**
   * Returns the uid when signed in. Otherwise shows a sign-in prompt and returns null.
   * Browsing never needs this; saving favorites, alerts and dealer inquiries do.
   */
  requireSignIn: (reason: string) => string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useMemo(() => firebaseStatus(), []);
  const auth = getFirebaseAuth();
  const [user, setUser] = useState<User | null>(auth?.currentUser ?? null);
  const [initializing, setInitializing] = useState(auth != null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, [auth]);

  const signOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
  }, [auth]);

  const requireSignIn = useCallback(
    (reason: string) => {
      if (user) return user.uid;
      if (!status.configured) {
        Alert.alert(
          'Browse-only mode',
          `${reason} needs a MatchRV account, but sign-in isn't configured in this build. You can keep browsing, asking AI, and checking tow fit.`,
        );
        return null;
      }
      Alert.alert('Sign in to continue', `${reason} requires signing in with Google. Browsing stays open without an account.`, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/account') },
      ]);
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
      signOut,
      requireSignIn,
    }),
    [user, initializing, status, signOut, requireSignIn],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
