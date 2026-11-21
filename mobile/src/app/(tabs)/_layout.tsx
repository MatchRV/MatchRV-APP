import { Tabs } from 'expo-router/tabs';
import { Text, View, type ColorValue } from 'react-native';

import { PreviewBanner } from '@/components/preview-banner';

import { useAuth } from '@/state/auth';
import { Colors, Fonts } from '@/theme';

// Simple glyph icons keep the bundle free of extra icon-font dependencies.
const icon = (glyph: string) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Text style={{ color, fontSize: size * 0.9, lineHeight: size * 1.1 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const { user } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <PreviewBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.divider },
          tabBarLabelStyle: { fontFamily: Fonts.body },
        }}>
        <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: icon('◈') }} />
        <Tabs.Screen name="ask" options={{ title: 'Ask AI', tabBarIcon: icon('✦') }} />
        <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: icon('♥') }} />
        <Tabs.Screen name="inquiries" options={{ title: 'Inquiries', tabBarIcon: icon('✉') }} />
        <Tabs.Screen name="account" options={{ title: user ? 'Account' : 'Sign in', tabBarIcon: icon('◉') }} />
      </Tabs>
    </View>
  );
}
