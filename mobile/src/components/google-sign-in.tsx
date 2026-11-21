// Google sign-in via expo-auth-session → Firebase credential.
// The hook throws if the current platform's client ID is missing, so callers must render this
// component only when googleClientIdForPlatform() returns a value.
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useState } from 'react';
import { Platform } from 'react-native';

import { config } from '@/lib/config';
import { getFirebaseAuth } from '@/lib/firebase/app';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/state/toast';

import { Button } from './ui';

WebBrowser.maybeCompleteAuthSession();

export function googleClientIdForPlatform(): string | undefined {
  const g = config.google;
  return Platform.select({ ios: g.iosClientId, android: g.androidClientId, default: g.webClientId });
}

export function GoogleSignInButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: config.google.webClientId,
    iosClientId: config.google.iosClientId,
    androidClientId: config.google.androidClientId,
  });

  const signIn = async () => {
    setBusy(true);
    try {
      const response = await promptAsync();
      if (response.type !== 'success') {
        if (response.type === 'error') toast(response.error?.message ?? 'Google sign-in failed');
        return;
      }
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      const auth = getFirebaseAuth();
      if (!idToken || !auth) {
        toast('Google did not return an ID token.');
        return;
      }
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      toast('Signed in');
    } catch (e) {
      toast(errorMessage(e, 'Firebase sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      title="Sign in with Google"
      loading={busy}
      disabled={!request}
      onPress={() => void signIn()}
      testID="google-sign-in"
    />
  );
}
