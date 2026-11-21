import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { Badge, RvPhoto } from '@/components/rv-card';
import { Button, Card, ChipRow, Loading, Notice, SpecRow } from '@/components/ui';
import { errorMessage, formatLength, formatPrice, formatWeight } from '@/lib/format';
import { rvTypeLabel, type RvDetail, type RvSummary } from '@/lib/models/rv';
import { useDiscover } from '@/state/discover';
import { mcp } from '@/state/services';
import { useUserData } from '@/state/user-data';
import { Colors, Spacing, Type } from '@/theme';

const yesNo = (v: boolean | null) => (v == null ? null : v ? 'Yes' : 'No');
const gal = (v: number | null) => (v != null && v > 0 ? `${v} gal` : null);

function summaryFromDetail(d: RvDetail): RvSummary {
  return {
    unitId: d.unitId, title: d.title, make: d.make ?? '', priceUsd: d.priceUsd, lengthFt: d.lengthFt,
    dryWeightLbs: d.dryWeightLbs, gvwrLbs: d.gvwrLbs, sleeps: d.sleeps, distanceMi: null, dealer: d.dealerName,
    dealerState: d.dealerState ?? '', matchScore: null, verified: false, floorplan: d.floorplanCode,
    walkthroughUrl: d.walkthroughUrl, walkthroughLabel: d.walkthroughLabel, listingUrl: d.listingUrl,
    thumbnailUrl: d.images[0] ?? null, rvType: d.rvType, condition: d.condition, year: d.year, isHydrated: true,
  };
}

export default function RvDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitId = String(id ?? '');
  const { width } = useWindowDimensions();
  const discover = useDiscover();
  const { applyDetail } = discover;
  const { saveRv, isSaved } = useUserData();
  const summary = discover.deck.find((d) => d.unitId === unitId);
  const [detail, setDetail] = useState<RvDetail | null>(() => mcp.getCachedDetail(unitId) ?? null);
  const [loading, setLoading] = useState(!detail);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDetail = useCallback(
    // Like Kotlin openRvDetail: force refresh when nothing is cached yet.
    () => mcp.getRv(unitId, mcp.getCachedDetail(unitId) == null),
    [unitId],
  );
  const onLoaded = useCallback(
    (d: RvDetail) => {
      setDetail(d);
      setLoading(false);
      applyDetail(unitId, d);
    },
    [applyDetail, unitId],
  );
  const onFailed = useCallback((e: unknown) => {
    setError(errorMessage(e, 'Could not load full RV record.'));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchDetail().then(
      (d) => active && onLoaded(d),
      (e) => active && onFailed(e),
    );
    return () => {
      active = false;
    };
  }, [fetchDetail, onLoaded, onFailed]);

  const retry = () => {
    setError(null);
    setLoading(true);
    fetchDetail().then(onLoaded, onFailed);
  };

  if (loading && !detail) return <Loading label="Loading verified RV record…" />;
  if (!detail) {
    return (
      <View style={{ flex: 1, padding: Spacing.lg }}>
        <Notice tone="error" title="Couldn't load this RV">{error ?? 'Unknown error'}</Notice>
        <Button title="Retry" onPress={retry} />
      </View>
    );
  }

  const saved = isSaved(detail.unitId);
  const location = [detail.dealerCity, detail.dealerState].filter(Boolean).join(', ');
  const features: [string, boolean | null][] = [
    ['Bunkhouse', detail.bunkhouse], ['Solar', detail.solar], ['Lithium battery', detail.lithiumBattery],
    ['Generator', detail.generator], ['Four-season', detail.fourSeason], ['Outdoor kitchen', detail.outdoorKitchen],
  ];

  return (
    <>
      <Stack.Screen options={{ title: detail.year ? `${detail.year} ${detail.make ?? ''}`.trim() : 'RV Details' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        {detail.images.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {detail.images.map((uri) => (
              <Image key={uri} source={{ uri }} style={{ width, height: width * 0.68 }} contentFit="cover" transition={200} />
            ))}
          </ScrollView>
        ) : (
          <RvPhoto uri={null} style={{ height: width * 0.5 }} />
        )}
        <View style={{ padding: Spacing.lg }}>
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <ChipRow>
            {detail.rvType ? <Badge text={rvTypeLabel(detail.rvType)} /> : null}
            {detail.condition ? <Badge text={detail.condition} /> : null}
            {detail.status ? <Badge text={detail.status.replace(/_/g, ' ')} accent /> : null}
            {detail.stockNumber ? <Badge text={`Stock #${detail.stockNumber}`} /> : null}
            {detail.vin ? <Badge text={`VIN …${detail.vin.slice(-8)}`} /> : null}
          </ChipRow>
          <Text style={[Type.headlineLarge, { color: Colors.text, marginTop: Spacing.sm }]}>{detail.title}</Text>
          <Text style={[Type.displayMedium, { color: Colors.accent }]}>{formatPrice(detail.priceUsd)}</Text>
          {detail.priceNote ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>Last listed price · {detail.priceNote}</Text> : null}
          {detail.msrpUsd ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>MSRP {formatPrice(detail.msrpUsd)}</Text> : null}

          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.lg }}>
            <Button
              title={saved ? '♥ Saved' : '♡ Save'}
              variant={saved ? 'outline' : 'primary'}
              loading={saving}
              disabled={saved}
              style={{ flex: 1 }}
              onPress={async () => {
                setSaving(true);
                await saveRv(summary ?? summaryFromDetail(detail), { detail });
                setSaving(false);
              }}
              testID="detail-save"
            />
            <Button title="Tow-Fit Check" variant="outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/tow-fit/[id]', params: { id: unitId } })} />
          </View>
          <Button title="Contact Dealer" onPress={() => router.push({ pathname: '/inquiry/[id]', params: { id: unitId } })} testID="detail-inquiry" />

          {detail.availabilityGuidance ? (
            <View style={{ marginTop: Spacing.lg }}>
              <Notice title="Availability">{detail.availabilityGuidance}</Notice>
            </View>
          ) : null}

          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.sm }]}>Verified Specifications</Text>
            <SpecRow label="Year / Make / Model" value={[detail.year, detail.make, detail.model, detail.trim].filter(Boolean).join(' ')} />
            <SpecRow label="Floorplan" value={detail.floorplanCode} />
            <SpecRow label="Length" value={formatLength(detail.lengthFt)} />
            <SpecRow label="Sleeps" value={detail.sleeps != null ? String(detail.sleeps) : null} />
            <SpecRow label="Slide-outs" value={detail.slideouts != null ? String(detail.slideouts) : null} />
            <SpecRow label="Dry weight" value={formatWeight(detail.dryWeightLbs)} />
            <SpecRow label="GVWR" value={formatWeight(detail.gvwrLbs)} />
            <SpecRow label="Hitch weight" value={formatWeight(detail.hitchWeightLbs)} />
            <SpecRow label="Fresh / grey / black" value={[gal(detail.freshWaterGal), gal(detail.greyWaterGal), gal(detail.blackWaterGal)].map((v) => v ?? '—').join(' / ')} />
            {features.map(([label, v]) => (
              <SpecRow key={label} label={label} value={yesNo(v)} />
            ))}
            {detail.powertrainSummary.map(([k, v]) => (
              <SpecRow key={k} label={k} value={v} />
            ))}
            {detail.boondockingScore != null ? <SpecRow label="Boondocking score" value={`${detail.boondockingScore}/100`} /> : null}
          </Card>

          {detail.boondockingKnown.length > 0 ? (
            <Card>
              <Text style={[Type.titleMedium, { color: Colors.text }]}>Boondocking inputs</Text>
              {detail.boondockingKnown.map((b) => (
                <Text key={b} style={[Type.bodySmall, { color: Colors.textMuted }]}>• {b}</Text>
              ))}
            </Card>
          ) : null}

          {detail.features.length > 0 ? (
            <Card>
              <Text style={[Type.titleMedium, { color: Colors.text }]}>Features</Text>
              {detail.features.map((f) => (
                <Text key={f} style={[Type.bodySmall, { color: Colors.textMuted }]}>• {f}</Text>
              ))}
            </Card>
          ) : null}

          {detail.description ? (
            <Card>
              <Text style={[Type.titleMedium, { color: Colors.text }]}>Dealer Description</Text>
              <Text style={[Type.bodyMedium, { color: Colors.textMuted, marginTop: 4 }]}>{detail.description}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={[Type.labelSmall, { color: Colors.textMuted }]}>Dealer</Text>
            <Text style={[Type.titleLarge, { color: Colors.text }]}>{detail.dealerName}</Text>
            {location ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{location}</Text> : null}
            {detail.lastSeenAt ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>Last seen on dealer site: {detail.lastSeenAt.slice(0, 10)}</Text> : null}
            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              {detail.listingUrl ? <Button title="View Dealer Listing" variant="outline" compact onPress={() => Linking.openURL(detail.listingUrl!)} /> : null}
              {detail.dealerWebsite ? <Button title="Dealer Website" variant="ghost" compact onPress={() => Linking.openURL(detail.dealerWebsite!)} /> : null}
              {detail.walkthroughUrl ? (
                <Button title={`Watch Model Walkthrough (${detail.walkthroughLabel ?? 'YouTube'})`} variant="ghost" compact onPress={() => Linking.openURL(detail.walkthroughUrl!)} />
              ) : null}
            </View>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}
