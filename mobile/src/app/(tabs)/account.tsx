import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSignInButton, googleClientIdForPlatform } from '@/components/google-sign-in';
import { Button, Card, Notice, SpecRow } from '@/components/ui';
import { config } from '@/lib/config';
import { askAiPrimary } from '@/state/services';
import { useAuth } from '@/state/auth';
import { Colors, Spacing, Type } from '@/theme';

export default function AccountScreen() {
  const { user, firebaseReady, firebaseError, signOut, initializing } = useAuth();
  const hasGoogleClient = !!googleClientIdForPlatform();
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <View style={{ alignItems: 'center', marginVertical: Spacing.xl }}>
          <Image source={require('../../../assets/images/icon.png')} style={{ width: 96, height: 96, borderRadius: 22 }} accessibilityLabel="MatchRV logo" />
          <Text style={[Type.headlineLarge, { color: Colors.text, marginTop: Spacing.md }]}>MatchRV</Text>
          <Text style={[Type.bodyMedium, { color: Colors.textMuted, textAlign: 'center' }]}>Swipe, compare, and contact dealers about real RVs on the lot.</Text>
        </View>

        {!firebaseReady ? (
          <Notice tone="warn" title="Browse-only mode">
            {firebaseError
              ? `Firebase failed to start: ${firebaseError}`
              : 'Firebase env config is missing, so sign-in, favorites, alerts and inquiries are disabled. Discover, RV details, Ask AI (on-device parser) and tow-fit checks still work.'}
          </Notice>
        ) : user ? (
          <Card>
            <Text style={[Type.labelSmall, { color: Colors.textMuted }]}>Signed in as</Text>
            <Text style={[Type.titleLarge, { color: Colors.text }]}>{user.displayName ?? user.email ?? 'MatchRV shopper'}</Text>
            {user.email ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{user.email}</Text> : null}
            <Button title="Sign out" variant="outline" onPress={signOut} style={{ marginTop: Spacing.md }} />
          </Card>
        ) : (
          <Card>
            <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.sm }]}>Sign in to save RVs, alerts and dealer inquiries</Text>
            {initializing ? null : hasGoogleClient ? (
              <GoogleSignInButton />
            ) : (
              <Notice tone="warn">No Google OAuth client ID is configured for this platform (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID).</Notice>
            )}
            {isExpoGo ? (
              <Text style={[Type.bodySmall, { color: Colors.textMuted, marginTop: Spacing.sm }]}>
                Note: Google blocks OAuth redirects to Expo Go. Use a development build to sign in.
              </Text>
            ) : null}
          </Card>
        )}

        <Card>
          <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.sm }]}>About this build</Text>
          <SpecRow label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <SpecRow label="Inventory source" value={config.mcpUrl} />
          <SpecRow label="Ask AI" value={askAiPrimary.isAvailable() ? `Gemini (${config.geminiModel}) + on-device fallback` : 'On-device parser'} />
          <SpecRow label="Accounts" value={firebaseReady ? 'Firebase (Google sign-in)' : 'Disabled'} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
