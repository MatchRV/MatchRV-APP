import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Notice, SpecRow } from '@/components/ui';
import { config } from '@/lib/config';
import { askAiPrimary } from '@/state/services';
import { useAuth } from '@/state/auth';
import { Colors, Spacing, Type } from '@/theme';

export default function AccountScreen() {
  const { user, firebaseReady, firebaseError, signOut, exitPreview } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <View style={{ alignItems: 'center', marginVertical: Spacing.xl }}>
          <Image source={require('../../../assets/images/icon.png')} style={{ width: 96, height: 96, borderRadius: 22 }} accessibilityLabel="MatchRV logo" />
          <Text style={[Type.headlineLarge, { color: Colors.text, marginTop: Spacing.md }]}>MatchRV</Text>
          <Text style={[Type.bodyMedium, { color: Colors.textMuted, textAlign: 'center' }]}>Swipe, compare, and contact dealers about real RVs on the lot.</Text>
        </View>

        {user ? (
          <Card>
            <Text style={[Type.labelSmall, { color: Colors.textMuted }]}>Signed in as</Text>
            <Text style={[Type.titleLarge, { color: Colors.text }]}>{user.displayName ?? user.email ?? 'MatchRV shopper'}</Text>
            {user.email ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{user.email}</Text> : null}
            <Text style={[Type.bodySmall, { color: Colors.textMuted, marginTop: Spacing.sm }]}>
              Your saved RVs, search alerts, and dealer inquiries sync across devices.
            </Text>
            <Button title="Sign out" variant="outline" onPress={() => void signOut()} style={{ marginTop: Spacing.md }} testID="sign-out" />
          </Card>
        ) : (
          <Card>
            <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.xs }]}>Preview mode (testing)</Text>
            <Text style={[Type.bodySmall, { color: Colors.textMuted, marginBottom: Spacing.md }]}>
              You&apos;re not signed in. MatchRV requires an account to save RVs, get price-drop alerts, and contact dealers.
            </Text>
            {!firebaseReady ? (
              <Notice tone="warn" title="Sign-in isn't configured">
                {firebaseError ? `Firebase failed to start: ${firebaseError}` : 'Firebase env config is missing in this build.'}
              </Notice>
            ) : null}
            <Button title="Go to sign-in" onPress={exitPreview} testID="exit-preview" />
          </Card>
        )}

        <Card>
          <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.sm }]}>About this build</Text>
          <SpecRow label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <SpecRow label="Inventory source" value={config.mcpUrl} />
          <SpecRow label="Ask AI" value={askAiPrimary.isAvailable() ? `Gemini (${config.geminiModel}) + on-device fallback` : 'On-device parser'} />
          <SpecRow label="Accounts" value={firebaseReady ? `Firebase (${Platform.OS === 'ios' ? 'Google + Apple' : 'Google'} sign-in, required)` : 'Not configured'} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
