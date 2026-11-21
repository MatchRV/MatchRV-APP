import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistance, formatLength, formatPrice, formatWeight } from '@/lib/format';
import { rvTypeLabel, type RvSummary } from '@/lib/models/rv';
import { Brand, Colors, Radius, Spacing, Type } from '@/theme';

export function RvPhoto({ uri, style }: { uri: string | null | undefined; style?: object }) {
  return uri ? (
    <Image source={{ uri }} style={[styles.photo, style]} contentFit="cover" transition={200} recyclingKey={uri} />
  ) : (
    <View style={[styles.photo, styles.photoPlaceholder, style]}>
      <Image source={require('../../assets/images/logo-transparent.png')} style={{ width: 120, height: 36, opacity: 0.35 }} contentFit="contain" />
    </View>
  );
}

function metaLine(rv: RvSummary): string {
  return [rv.sleeps != null ? `Sleeps ${rv.sleeps}` : null, formatLength(rv.lengthFt), formatWeight(rv.dryWeightLbs ?? rv.gvwrLbs)]
    .filter(Boolean)
    .join(' · ');
}

/** Full-height card for the swipe deck. */
export function SwipeCardContent({ rv }: { rv: RvSummary }) {
  return (
    <View style={styles.swipeCard}>
      <RvPhoto uri={rv.thumbnailUrl} style={{ flex: 1 }} />
      <View style={styles.swipeBody}>
        <View style={styles.badgeRow}>
          {rv.rvType ? <Badge text={rvTypeLabel(rv.rvType)} /> : null}
          {rv.condition ? <Badge text={rv.condition} /> : null}
          {rv.verified ? <Badge text="Verified" accent /> : null}
          {rv.matchScore != null ? <Badge text={`${rv.matchScore}% match`} accent /> : null}
        </View>
        <Text style={[Type.titleLarge, { color: Colors.text }]} numberOfLines={2}>
          {rv.title}
        </Text>
        <Text style={[Type.headlineMedium, { color: Colors.accent }]}>{formatPrice(rv.priceUsd)}</Text>
        <Text style={[Type.bodySmall, { color: Colors.textMuted }]} numberOfLines={1}>
          {metaLine(rv)}
        </Text>
        <Text style={[Type.bodySmall, { color: Colors.textMuted }]} numberOfLines={1}>
          {[rv.dealer, formatDistance(rv.distanceMi)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

export function RvGridItem({ rv, onPress, width }: { rv: RvSummary; onPress: () => void; width: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.gridItem, { width }]} accessibilityRole="button" accessibilityLabel={rv.title}>
      <RvPhoto uri={rv.thumbnailUrl} style={{ height: width * 0.7 }} />
      <View style={{ padding: Spacing.sm, gap: 2 }}>
        <Text style={[Type.titleSmall, { color: Colors.text }]} numberOfLines={2}>
          {rv.title}
        </Text>
        <Text style={[Type.labelLarge, { color: Colors.accent }]}>{formatPrice(rv.priceUsd)}</Text>
        <Text style={[Type.labelSmall, { color: Colors.textMuted }]} numberOfLines={1}>
          {rv.dealerState || rv.dealer}
        </Text>
      </View>
    </Pressable>
  );
}

export function RvListRow({ rv, onPress, right }: { rv: Pick<RvSummary, 'title' | 'priceUsd' | 'thumbnailUrl' | 'dealer'>; onPress: () => void; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={styles.listRow} accessibilityRole="button">
      <RvPhoto uri={rv.thumbnailUrl} style={{ width: 84, height: 64, borderRadius: Radius.sm }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Type.titleSmall, { color: Colors.text }]} numberOfLines={2}>
          {rv.title}
        </Text>
        <Text style={[Type.labelLarge, { color: Colors.accent }]}>{formatPrice(rv.priceUsd)}</Text>
        <Text style={[Type.labelSmall, { color: Colors.textMuted }]} numberOfLines={1}>
          {rv.dealer}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

export function Badge({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={[styles.badge, accent && { backgroundColor: Brand.aquaInk, borderColor: Brand.aquaDeep }]}>
      <Text style={[Type.labelSmall, { color: accent ? Brand.aquaSoft : Colors.text, textTransform: 'capitalize' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', backgroundColor: Colors.surfaceHigh },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  swipeCard: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swipeBody: { padding: Spacing.lg, gap: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gridItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', paddingVertical: Spacing.sm },
});
