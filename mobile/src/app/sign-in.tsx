// Welcome / sign-in gate — port of ui/screens/AuthScreen.kt. Shown whenever nobody is signed in.
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppleSignInButton, useAppleSignInAvailable } from '@/components/apple-sign-in';
import { GoogleSignInButton, googleClientIdForPlatform } from '@/components/google-sign-in';
import { Button, Notice } from '@/components/ui';
import { welcomeHeadline } from '@/lib/auth/gate';
import { useAuth } from '@/state/auth';
import { useDiscover } from '@/state/discover';
import { Brand, Colors, Radius, Spacing, Type } from '@/theme';

const FEATURES = [
  { glyph: '◈', tint: Brand.aqua, title: 'Swipe or Grid Browse', subtitle: 'Save favorites with a right swipe and track live price drops.' },
  { glyph: '✦', tint: Brand.amber, title: 'Ask AI Search', subtitle: 'Describe your dream RV in plain English for an AI-curated deck.' },
  { glyph: '✉', tint: Brand.aqua, title: 'Verified Dealer Inquiries', subtitle: 'Preview every inquiry before sending and track live dealer status.' },
] as const;

const signInButtonStyle = { minHeight: 56, borderRadius: Radius.md + 2 };

export default function SignInScreen() {
  const { firebaseReady, firebaseError, previewAllowed, startPreview } = useAuth();
  // DiscoverProvider already runs a default search_rvs on launch; reuse its live LIVE count.
  const { eligibleInventoryCount } = useDiscover();
  const appleAvailable = useAppleSignInAvailable();
  const hasGoogleClient = !!googleClientIdForPlatform();
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  return (
    <View style={styles.root}>
      {/* Soft aqua glow approximating the Compose radial gradient. */}
      <View style={styles.glow} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.hero}>
            <View style={styles.logoPlate}>
              <Image
                source={require('../../assets/images/logo-transparent.png')}
                style={{ width: 216, height: 64 }}
                contentFit="contain"
                accessibilityLabel="MatchRV logo"
              />
            </View>
            <Text style={[Type.displayMedium, styles.center, { color: Colors.text }]} testID="welcome-headline">
              {welcomeHeadline(eligibleInventoryCount)}
            </Text>
            <Text style={[Type.bodyLarge, styles.center, { color: Colors.textMuted }]}>
              Powered directly by MatchRV&apos;s real-time nationwide dealer inventory. Find your rig, check tow fit, and connect with the
              dealer — zero guesswork.
            </Text>
          </View>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Text style={{ color: f.tint, fontSize: 18 }}>{f.glyph}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[Type.titleMedium, { color: Colors.text }]}>{f.title}</Text>
                  <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{f.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            {!firebaseReady ? (
              <>
                <Button title="Sign in with Google" disabled onPress={() => {}} style={signInButtonStyle} />
                <Notice tone="warn" title="Sign-in isn't configured">
                  {firebaseError
                    ? `Firebase failed to start: ${firebaseError}`
                    : 'Firebase env config is missing in this build (see README → Environment variables).'}
                </Notice>
              </>
            ) : (
              <>
                {hasGoogleClient ? (
                  <GoogleSignInButton style={signInButtonStyle} />
                ) : (
                  <>
                    <Button title="Sign in with Google" disabled onPress={() => {}} style={signInButtonStyle} />
                    <Notice tone="warn">No Google OAuth client ID is configured for this platform (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID).</Notice>
                  </>
                )}
                {appleAvailable ? <AppleSignInButton /> : null}
                {isExpoGo ? (
                  <Text style={[Type.bodySmall, styles.center, { color: Colors.textMuted }]}>
                    Note: Google and Apple sign-in can&apos;t complete in Expo Go. Use a development build to sign in.
                  </Text>
                ) : null}
              </>
            )}

            <Text style={[Type.bodySmall, styles.center, { color: Colors.textMuted }]}>
              Sign in to sync your saved RVs, search alerts, and dealer inquiries across devices.
            </Text>

            {previewAllowed ? (
              <Pressable accessibilityRole="button" onPress={startPreview} testID="preview-bypass" style={styles.previewLink}>
                <Text style={[Type.labelMedium, styles.center, { color: Brand.amber, textDecorationLine: 'underline' }]}>
                  Preview without sign-in (testing)
                </Text>
                <Text style={[Type.bodySmall, styles.center, { color: Colors.textMuted }]}>
                  Dev-only. Hidden in production builds with Firebase configured.
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.ink950 },
  glow: {
    position: 'absolute',
    top: -160,
    alignSelf: 'center',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(45,226,210,0.10)',
  },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    justifyContent: 'space-between',
    gap: 28,
  },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: Spacing.lg, marginTop: Spacing.lg },
  logoPlate: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    marginBottom: Spacing.xs,
  },
  features: {
    borderRadius: 24,
    backgroundColor: 'rgba(10,26,39,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(45,226,210,0.18)',
    padding: 20,
    gap: Spacing.lg,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.ink800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: Spacing.md },
  previewLink: { paddingVertical: Spacing.sm, gap: 2 },
});
