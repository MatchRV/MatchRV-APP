import { Text, View } from 'react-native';

import { useAuth } from '@/state/auth';
import { Colors, Spacing, Type } from '@/theme';

import { Button, Centered, Notice } from './ui';

/** Shown in place of account-only screens (Saved, Inquiries) in the dev-only preview mode. */
export function SignInGate({ feature }: { feature: string }) {
  const { firebaseReady, exitPreview } = useAuth();
  return (
    <Centered>
      <Text style={[Type.headlineMedium, { color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm }]}>Sign in to use {feature}</Text>
      <Text style={[Type.bodyMedium, { color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg }]}>
        Sign-in is required for saved RVs, price-drop alerts, and dealer inquiries. You&apos;re in preview mode without an account.
      </Text>
      {firebaseReady ? (
        <Button title="Sign in" onPress={exitPreview} />
      ) : (
        <View>
          <Notice tone="warn" title="Sign-in isn't configured">
            Firebase isn&apos;t configured in this build, so accounts are unavailable. See README → Environment variables.
          </Notice>
        </View>
      )}
    </Centered>
  );
}
