import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler } from '@/lib/notifications';
import { AuthProvider } from '@/state/auth';
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

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <ToastProvider>
            <AuthProvider>
              <UserDataProvider>
                <DiscoverProvider>
                  <StatusBar style="light" />
                  <Stack
                    screenOptions={{
                      headerStyle: { backgroundColor: Colors.surface },
                      headerTintColor: Colors.text,
                      headerTitleStyle: { fontFamily: Fonts.display },
                      contentStyle: { backgroundColor: Colors.background },
                    }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="rv/[id]" options={{ title: 'RV Details' }} />
                    <Stack.Screen name="tow-fit/[id]" options={{ title: 'Tow-Fit Check' }} />
                    <Stack.Screen name="inquiry/[id]" options={{ title: 'Contact Dealer' }} />
                    <Stack.Screen name="compare" options={{ title: 'Compare RVs' }} />
                  </Stack>
                </DiscoverProvider>
              </UserDataProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
