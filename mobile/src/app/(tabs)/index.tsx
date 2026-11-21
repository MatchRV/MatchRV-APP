import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSheet } from '@/components/filter-sheet';
import { RvGridItem } from '@/components/rv-card';
import { SwipeDeck, type SwipeDirection } from '@/components/swipe-deck';
import { Button, Centered, Chip, Loading, Notice } from '@/components/ui';
import { formatCount } from '@/lib/format';
import { openRv as openRvRoute } from '@/lib/nav';
import { activeFilterCount, filterSummaryLabel, type RvSummary } from '@/lib/models/rv';
import { useAuth } from '@/state/auth';
import { useDiscover } from '@/state/discover';
import { useUserData } from '@/state/user-data';
import { Colors, Radius, Spacing, Type } from '@/theme';

const openRv = (rv: Pick<RvSummary, 'unitId'>) => openRvRoute(rv.unitId);

export default function DiscoverScreen() {
  const d = useDiscover();
  const { user } = useAuth();
  const { saveRv, saveAlert, track } = useUserData();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { width } = useWindowDimensions();
  const gridItemWidth = (width - Spacing.lg * 2 - Spacing.md) / 2;
  const filterCount = activeFilterCount(d.filter);

  const onSwipe = (rv: RvSummary, dir: SwipeDirection) => {
    if (dir === 'right') {
      // Not signed in: keep the card recoverable via Undo while the sign-in prompt shows.
      d.removeCard(rv, !user);
      void saveRv(rv, { fromSwipe: true });
    } else {
      d.removeCard(rv, true);
      track('swipe_left', { unitId: rv.unitId, rvType: rv.rvType, priceUsd: rv.priceUsd });
    }
  };

  const top = d.deck[0];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../../assets/images/logo-transparent.png')} style={styles.logo} contentFit="contain" accessibilityLabel="MatchRV" />
        <View style={{ flex: 1 }} />
        <Chip label="Swipe" selected={d.browseMode === 'swipe'} onPress={() => d.setBrowseMode('swipe')} />
        <Chip label="Grid" selected={d.browseMode === 'grid'} onPress={() => d.setBrowseMode('grid')} />
      </View>

      <View style={styles.subHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[Type.labelMedium, { color: Colors.accent }]} testID="live-count">
            {d.eligibleInventoryCount != null ? `${formatCount(d.eligibleInventoryCount)} live dealer RVs` : 'Live dealer inventory'}
          </Text>
          <Text style={[Type.bodySmall, { color: Colors.textMuted }]} numberOfLines={1}>
            {filterSummaryLabel(d.filter)}
          </Text>
        </View>
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.filterBtn} accessibilityRole="button" accessibilityLabel="Open filters">
          <Text style={[Type.labelLarge, { color: Colors.accent }]}>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</Text>
        </Pressable>
      </View>

      {d.aiCuratedSummary ? (
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <Notice title="AI curated deck">{d.aiCuratedSummary}</Notice>
        </View>
      ) : null}

      {d.isLoading ? (
        <Loading label="Loading live MatchRV inventory…" />
      ) : d.errorMessage ? (
        <Centered>
          <Notice tone="error" title="Couldn't load RVs">{d.errorMessage}</Notice>
          <Button title="Retry" onPress={d.reload} />
        </Centered>
      ) : d.deck.length === 0 ? (
        <Centered>
          <Text style={[Type.titleLarge, { color: Colors.text, textAlign: 'center' }]}>
            {d.isPrefetching ? 'Loading more dealer units…' : 'No more RVs in this deck'}
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg }}>
            <Button title="Reset Filters" variant="outline" onPress={d.resetFilters} />
            <Button title="Refresh Deck" onPress={d.reload} />
          </View>
        </Centered>
      ) : d.browseMode === 'swipe' ? (
        <>
          <SwipeDeck deck={d.deck} onSwipe={onSwipe} onOpen={openRv} />
          <View style={styles.actions}>
            <Button title="↶ Undo" variant="ghost" compact disabled={d.passedStack.length === 0} onPress={d.undoLastPass} />
            <Button title="✕ Pass" variant="danger" style={{ flex: 1 }} onPress={() => top && onSwipe(top, 'left')} testID="pass-button" />
            <Button title="Details" variant="outline" onPress={() => top && openRv(top)} />
            <Button title="♥ Save" style={{ flex: 1 }} onPress={() => top && onSwipe(top, 'right')} testID="save-button" />
          </View>
        </>
      ) : (
        <FlatList
          data={d.deck}
          keyExtractor={(i) => i.unitId}
          numColumns={2}
          columnWrapperStyle={{ gap: Spacing.md }}
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
          renderItem={({ item }) => <RvGridItem rv={item} width={gridItemWidth} onPress={() => openRv(item)} />}
          ListFooterComponent={
            <Button title={d.isPrefetching ? 'Loading more dealer units…' : 'Load More Matching RVs'} variant="outline" loading={d.isPrefetching} onPress={d.loadMore} />
          }
        />
      )}

      <FilterSheet
        visible={filtersOpen}
        filter={d.filter}
        onDismiss={() => setFiltersOpen(false)}
        onApply={(f) => d.applyFilter(f)}
        onSaveAlert={(f) => {
          setFiltersOpen(false);
          void saveAlert(f, d.deck.map((u) => u.unitId));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  logo: { width: 130, height: 38 },
  subHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.md },
  filterBtn: { borderWidth: 1, borderColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, alignItems: 'center' },
});
