import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/state/auth';
import { Brand, Colors, Spacing, Type } from '@/theme';

/** Thin banner above the tabs while in the dev-only preview mode; tapping returns to the welcome screen. */
export function PreviewBanner() {
  const { previewMode, user, exitPreview } = useAuth();
  if (!previewMode || user) return null;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: Brand.ink850, borderBottomWidth: 1, borderBottomColor: Brand.amber }}>
      <Pressable accessibilityRole="button" onPress={exitPreview} testID="preview-banner" style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.lg }}>
        <Text style={[Type.labelSmall, { color: Brand.amber, textAlign: 'center' }]}>
          Preview mode — <Text style={{ color: Colors.accent, textDecorationLine: 'underline' }}>sign in</Text>
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
