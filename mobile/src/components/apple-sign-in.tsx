// Sign in with Apple (iOS only) → Firebase OAuthProvider('apple.com') credential.
// App Store guideline 4.8 requires it because Google sign-in is offered.
// Owner setup (Apple capability, Firebase Apple provider) is documented in README → Authentication.
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { nonceFromBytes } from '@/lib/auth/nonce';
import { getFirebaseAuth } from '@/lib/firebase/app';
import { errorMessage } from '@/lib/format';
import { useToast } from '@/state/toast';

/** Resolves true only on iOS devices where Sign in with Apple is available. */
export function useAppleSignInAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => alive && setAvailable(ok))
      .catch(() => alive && setAvailable(false));
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

function isCancel(e: unknown): boolean {
  return typeof e === 'object' && e != null && (e as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}

export function AppleSignInButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (busy) return;
    const auth = getFirebaseAuth();
    if (!auth) {
      toast('Sign-in is not configured in this build.');
      return;
    }
    setBusy(true);
    try {
      // Apple receives the SHA-256 of the nonce; Firebase verifies the raw value against the token.
      const rawNonce = nonceFromBytes(Crypto.getRandomBytes(32));
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const apple = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!apple.identityToken) {
        toast('Apple did not return an identity token.');
        return;
      }
      const credential = new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce });
      const result = await signInWithCredential(auth, credential);
      // Apple only shares the name on the very first authorization — keep it on the Firebase profile.
      const name = [apple.fullName?.givenName, apple.fullName?.familyName].filter(Boolean).join(' ');
      if (name && !result.user.displayName) {
        await updateProfile(result.user, { displayName: name }).catch(() => {});
      }
      toast('Signed in');
    } catch (e) {
      if (!isCancel(e)) toast(errorMessage(e, 'Apple sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={16}
        style={{ width: '100%', height: 56 }}
        onPress={() => void signIn()}
      />
    </View>
  );
}
