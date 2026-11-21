import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RvListRow } from '@/components/rv-card';
import { SignInGate } from '@/components/sign-in-gate';
import { Button, Card, Chip, Loading, Notice } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { alertToSearchFilter, priceDropAmountUsd } from '@/lib/models/firestore';
import { openRv } from '@/lib/nav';
import { areAlertNotificationsEnabled, disableAlertNotifications, enableAlertNotifications } from '@/lib/notifications';
import { useAuth } from '@/state/auth';
import { useDiscover } from '@/state/discover';
import { useToast } from '@/state/toast';
import { useUserData } from '@/state/user-data';
import { Brand, Colors, Radius, Spacing, Type } from '@/theme';

function NotificationToggle() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    void areAlertNotificationsEnabled().then(setEnabled);
  }, []);
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[Type.titleSmall, { color: Colors.text }]}>Notify me on this device</Text>
        <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>Local notification when a check finds price drops or new matches.</Text>
      </View>
      <Switch
        value={enabled}
        trackColor={{ true: Brand.aquaDeep, false: Colors.divider }}
        thumbColor={enabled ? Colors.accent : Colors.textMuted}
        onValueChange={async (v) => {
          if (v) {
            const granted = await enableAlertNotifications(); // permission is requested only here
            setEnabled(granted);
            if (!granted) toast('Notifications are blocked — enable them in system settings.');
          } else {
            await disableAlertNotifications();
            setEnabled(false);
          }
        }}
        accessibilityLabel="Enable alert notifications"
      />
    </View>
  );
}

export default function SavedScreen() {
  const { user, initializing } = useAuth();
  const ud = useUserData();
  const discover = useDiscover();
  const [tab, setTab] = useState<'rvs' | 'alerts'>('rvs');

  if (initializing) return <Loading />;
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <SignInGate feature="Saved RVs & alerts" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={styles.tabs}>
        <Chip label={`Saved RVs (${ud.savedRvs.data.length})`} selected={tab === 'rvs'} onPress={() => setTab('rvs')} />
        <Chip label={`Search Alerts (${ud.alerts.data.length})`} selected={tab === 'alerts'} onPress={() => setTab('alerts')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        {tab === 'rvs' ? (
          <>
            <View style={styles.row}>
              <Button title={ud.isCheckingPrices ? 'Checking…' : 'Check Drops'} variant="outline" loading={ud.isCheckingPrices} onPress={ud.refreshPricesNow} style={{ flex: 1 }} />
              <Button
                title={`Compare (${ud.compareIds.length})`}
                disabled={ud.compareIds.length < 2}
                onPress={() => router.push('/compare')}
                style={{ flex: 1 }}
              />
            </View>
            <Text style={[Type.bodySmall, { color: Colors.textMuted, marginBottom: Spacing.md }]}>Tap “Compare” on 2–4 saved RVs to see them side by side.</Text>
            {ud.savedRvs.status === 'loading' ? <Loading /> : null}
            {ud.savedRvs.status === 'error' ? <Notice tone="error">{ud.savedRvs.error}</Notice> : null}
            {ud.savedRvs.status === 'ready' && ud.savedRvs.data.length === 0 ? (
              <Notice>No saved RVs yet. Swipe right on Discover to save one.</Notice>
            ) : null}
            {ud.savedRvs.data.map((s) => {
              const drop = priceDropAmountUsd(s);
              const selected = ud.compareIds.includes(s.unitId);
              return (
                <Card key={s.id} style={{ paddingVertical: Spacing.sm }}>
                  <RvListRow
                    rv={{ title: s.title, priceUsd: s.lastCheckedPriceUsd || s.savedPriceUsd, thumbnailUrl: s.imageUrl ?? null, dealer: [s.dealerName, s.dealerState].filter(Boolean).join(', ') }}
                    onPress={() => openRv(s.unitId)}
                  />
                  {drop > 0 ? (
                    <Text style={[Type.labelMedium, { color: Colors.accent }]}>
                      ↓ Price drop {formatPrice(drop)} (was {formatPrice(s.savedPriceUsd)})
                    </Text>
                  ) : null}
                  <View style={[styles.row, { marginTop: Spacing.sm, marginBottom: 0 }]}>
                    <Chip label={selected ? '✓ Comparing' : 'Compare'} selected={selected} onPress={() => ud.toggleCompare(s.unitId)} />
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={() => ud.removeSavedRv(s.id)} accessibilityRole="button">
                      <Text style={[Type.labelLarge, { color: Brand.passCoral }]}>Remove</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </>
        ) : (
          <>
            <NotificationToggle />
            <Button
              title={ud.isCheckingAlerts ? 'Scanning live MatchRV inventory…' : 'Check for New Matches Now'}
              loading={ud.isCheckingAlerts}
              onPress={ud.checkAlertsNow}
              style={{ marginBottom: Spacing.md }}
            />
            {ud.alerts.status === 'error' ? <Notice tone="error">{ud.alerts.error}</Notice> : null}
            {ud.alerts.status === 'ready' && ud.alerts.data.length === 0 ? (
              <Notice>No saved searches yet. Open Filters on Discover and tap “Save Alert”.</Notice>
            ) : null}
            {ud.alerts.data.map((a) => (
              <Card key={a.id}>
                <View style={styles.toggleRow}>
                  <Text style={[Type.titleMedium, { color: Colors.text, flex: 1 }]}>{a.label}</Text>
                  <Switch
                    value={a.alertsEnabled}
                    onValueChange={(v) => ud.toggleAlert(a.id, v)}
                    trackColor={{ true: Brand.aquaDeep, false: Colors.divider }}
                    thumbColor={a.alertsEnabled ? Colors.accent : Colors.textMuted}
                    accessibilityLabel={`Alert ${a.label} enabled`}
                  />
                </View>
                <Text style={[Type.labelMedium, { color: a.newMatchCount > 0 ? Colors.accent : Colors.textMuted }]}>
                  {a.newMatchCount > 0 ? `${a.newMatchCount} new since last check · ` : ''}
                  {a.matchCount} matches last check
                </Text>
                <View style={[styles.row, { marginTop: Spacing.sm, marginBottom: 0 }]}>
                  <Button
                    title="Open in Swipe Deck"
                    compact
                    variant="outline"
                    onPress={() => {
                      discover.applyFilter(alertToSearchFilter(a));
                      router.navigate('/');
                    }}
                  />
                  <View style={{ flex: 1 }} />
                  <Pressable onPress={() => ud.deleteAlert(a.id)} accessibilityRole="button">
                    <Text style={[Type.labelLarge, { color: Brand.passCoral }]}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
});
