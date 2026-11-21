import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RvPhoto } from '@/components/rv-card';
import { SignInGate } from '@/components/sign-in-gate';
import { Button, Card, Loading, Notice } from '@/components/ui';
import { formatPrice, inquiryStatusColor, inquiryStatusLabel } from '@/lib/format';
import { openRv } from '@/lib/nav';
import { useAuth } from '@/state/auth';
import { useUserData } from '@/state/user-data';
import { Colors, Radius, Spacing, Type } from '@/theme';

export default function InquiriesScreen() {
  const { user, initializing } = useAuth();
  const { inquiries, refreshInquiryStatus, refreshingInquiryId } = useUserData();

  if (initializing) return <Loading />;
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <SignInGate feature="dealer inquiries" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <FlatList
        data={inquiries.data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: Spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[Type.headlineLarge, { color: Colors.text }]}>Dealer Inquiries</Text>
            {inquiries.status === 'loading' ? <Loading /> : null}
            {inquiries.status === 'error' ? <Notice tone="error">{inquiries.error}</Notice> : null}
            {inquiries.status === 'ready' && inquiries.data.length === 0 ? (
              <Notice>No inquiries yet. Open an RV and tap “Contact Dealer” to ask about price and availability.</Notice>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <RvPhoto uri={item.imageUrl} style={{ width: 72, height: 56, borderRadius: Radius.sm }} />
              <View style={{ flex: 1 }}>
                <Text style={[Type.titleSmall, { color: Colors.text }]} numberOfLines={2}>
                  {item.rvTitle}
                </Text>
                <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>
                  {[item.dealerName, item.dealerLocation].filter(Boolean).join(' · ')}
                </Text>
                {item.priceUsd ? <Text style={[Type.labelMedium, { color: Colors.accent }]}>{formatPrice(item.priceUsd)}</Text> : null}
              </View>
            </View>
            <Text style={[Type.labelMedium, { color: inquiryStatusColor(item.status), marginTop: Spacing.sm }]}>
              {inquiryStatusLabel(item.status)}
              {item.dryRun ? ' (test)' : ''}
            </Text>
            <Text style={[Type.bodySmall, { color: Colors.textMuted, marginTop: 4 }]} numberOfLines={3}>
              “{item.message}”
            </Text>
            {item.dealerReply ? (
              <Notice title="Dealer reply">{item.dealerReply}</Notice>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <Button
                title="Refresh Status"
                compact
                variant="outline"
                loading={refreshingInquiryId === item.id}
                onPress={() => refreshInquiryStatus(item)}
                style={{ flex: 1 }}
              />
              <Button title="View RV" compact onPress={() => openRv(item.unitId)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
