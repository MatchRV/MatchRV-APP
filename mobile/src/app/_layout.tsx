import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/state/auth';
import { DiscoverProvider } from '@/state/discover';
import { ToastProvider } from '@/state/toast';
import { UserDataProvider } from '@/state/user-data';
import { Colors, FontAssets, Fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();
configureNotificationHandler();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.divider,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FontAssets);

  const fontsReady = fontsLoaded || !!fontError;
  if (!fontsReady) return null; // native splash stays up

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <ToastProvider>
            <AuthProvider>
              <UserDataProvider>
                <DiscoverProvider>
                  <StatusBar style="light" />
                  <RootNavigator />
                </DiscoverProvider>
              </UserDataProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Sign-in is required: the app (tabs + detail screens) is only reachable with a Firebase user,
 * or in the dev-only in-memory preview mode. Everyone else sees the welcome / sign-in screen.
 * Flipping a guard makes Expo Router redirect to the first available screen automatically,
 * so signing in lands on the tabs and signing out lands back on the welcome screen.
 */
function RootNavigator() {
  const { user, initializing, previewMode } = useAuth();
  const canEnterApp = !!user || previewMode;

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync();
  }, [initializing]);

  // Never render the navigator before Firebase restores the session — no flash of tabs or welcome.
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontFamily: Fonts.display },
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Protected guard={canEnterApp}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="rv/[id]" options={{ title: 'RV Details' }} />
        <Stack.Screen name="tow-fit/[id]" options={{ title: 'Tow-Fit Check' }} />
        <Stack.Screen name="inquiry/[id]" options={{ title: 'Contact Dealer' }} />
        <Stack.Screen name="compare" options={{ title: 'Compare RVs' }} />
      </Stack.Protected>
      <Stack.Protected guard={!canEnterApp}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}
