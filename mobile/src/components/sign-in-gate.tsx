import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useAuth } from '@/state/auth';
import { Colors, Spacing, Type } from '@/theme';

import { Button, Centered, Notice } from './ui';

/** Shown in place of account-only screens (Saved, Inquiries) when signed out. */
export function SignInGate({ feature }: { feature: string }) {
  const { firebaseReady } = useAuth();
  return (
    <Centered>
      <Text style={[Type.headlineMedium, { color: Colors.text, textAlign: 'center', marginBottom: Spacing.sm }]}>Sign in to use {feature}</Text>
      <Text style={[Type.bodyMedium, { color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.lg }]}>
        Browsing, Ask AI, and tow-fit checks work without an account. Saving favorites, alerts, and dealer inquiries need a free MatchRV sign-in.
      </Text>
      {firebaseReady ? (
        <Button title="Sign in with Google" onPress={() => router.push('/account')} />
      ) : (
        <View>
          <Notice tone="warn" title="Browse-only mode">
            Firebase isn&apos;t configured in this build, so accounts are disabled. See README → Environment variables.
          </Notice>
        </View>
      )}
    </Centered>
  );
}
