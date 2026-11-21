// Two-step verified dealer inquiry: prepare_dealer_inquiry (sends nothing) → preview → explicit
// confirm → send_dealer_inquiry → record in Firestore; status via get_dealer_inquiry_status (Inquiries tab).
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';

import { SignInGate } from '@/components/sign-in-gate';
import { Button, Card, Field, Loading, Notice } from '@/components/ui';
import { errorMessage, formatPrice } from '@/lib/format';
import type { DealerInquiryPreview, DealerInquiryReceipt, RvDetail } from '@/lib/models/rv';
import { useAuth } from '@/state/auth';
import { mcp } from '@/state/services';
import { useToast } from '@/state/toast';
import { useUserData } from '@/state/user-data';
import { Brand, Colors, Spacing, Type } from '@/theme';

type Flow =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'preview'; preview: DealerInquiryPreview }
  | { kind: 'sending'; preview: DealerInquiryPreview }
  | { kind: 'sent'; receipt: DealerInquiryReceipt; preview: DealerInquiryPreview }
  | { kind: 'error'; message: string };

export default function InquiryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitId = String(id ?? '');
  const { user, initializing } = useAuth();
  const { recordInquiry } = useUserData();
  const toast = useToast();
  const [detail, setDetail] = useState<RvDetail | null>(() => mcp.getCachedDetail(unitId) ?? null);
  const [name, setName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(
    `Hi, I'm interested in the ${detail?.title ?? 'RV'}${detail?.stockNumber ? ` (stock #${detail.stockNumber})` : ''}. Is it still available, and what is the out-the-door price?`,
  );
  const [dryRun, setDryRun] = useState(false);
  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });

  useEffect(() => {
    if (!detail) void mcp.getRv(unitId).then(setDetail).catch(() => {});
  }, [detail, unitId]);

  if (initializing) return <Loading />;
  if (!user) return <SignInGate feature="dealer inquiries" />;

  const prepare = async () => {
    setFlow({ kind: 'preparing' });
    try {
      const preview = await mcp.prepareDealerInquiry({ unitId, name, email, phone, message });
      setFlow({ kind: 'preview', preview });
    } catch (e) {
      setFlow({ kind: 'error', message: errorMessage(e, 'Could not prepare dealer inquiry preview.') });
    }
  };

  const send = async (preview: DealerInquiryPreview) => {
    setFlow({ kind: 'sending', preview });
    try {
      const receipt = await mcp.sendDealerInquiry(preview.confirmationToken, dryRun);
      await recordInquiry(unitId, preview, receipt, detail);
      setFlow({ kind: 'sent', receipt, preview });
      toast(receipt.dryRun ? 'Test inquiry validated (dry run)' : `Inquiry sent to ${preview.dealerName}`);
    } catch (e) {
      setFlow({ kind: 'error', message: errorMessage(e, 'Failed to deliver dealer inquiry.') });
    }
  };

  const confirmSend = (preview: DealerInquiryPreview) => {
    if (dryRun) return void send(preview);
    Alert.alert('Send to dealer?', `MatchRV will deliver this message to ${preview.dealerName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: () => void send(preview) },
    ]);
  };

  if (flow.kind === 'sent') {
    return (
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
        <Notice title={flow.receipt.dryRun ? 'Test inquiry validated' : 'Inquiry sent'}>{flow.receipt.statusMessage}</Notice>
        <Text style={[Type.bodySmall, { color: Colors.textMuted, marginBottom: Spacing.lg }]}>
          Inquiry ID {flow.receipt.inquiryId} · status {flow.receipt.status.replace(/_/g, ' ')}. Track replies on the Inquiries tab.
        </Text>
        <Button title="Done" onPress={() => router.back()} />
        <Button title="View Inquiries" variant="ghost" onPress={() => router.navigate('/inquiries')} style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    );
  }

  const preview = flow.kind === 'preview' || flow.kind === 'sending' ? flow.preview : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
        {detail ? <Text style={[Type.titleLarge, { color: Colors.text, marginBottom: Spacing.md }]}>{detail.title}</Text> : null}
        {flow.kind === 'error' ? <Notice tone="error">{flow.message}</Notice> : null}

        {preview ? (
          <Card>
            <Text style={[Type.labelSmall, { color: Colors.accent }]}>Preview — nothing has been sent yet</Text>
            <Text style={[Type.titleMedium, { color: Colors.text, marginTop: Spacing.sm }]}>To: {preview.dealerName}</Text>
            {preview.dealerLocation ? <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{preview.dealerLocation}</Text> : null}
            <Text style={[Type.labelSmall, { color: Colors.accent }]}>Delivery: {preview.deliveryMethod}</Text>
            <Text style={[Type.titleSmall, { color: Colors.text, marginTop: Spacing.sm }]}>RV: {preview.rvTitle}</Text>
            <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>
              {[preview.stockNumber ? `Stock #${preview.stockNumber}` : null, preview.vin ? `VIN ${preview.vin}` : null, preview.priceUsd ? formatPrice(preview.priceUsd) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={[Type.bodySmall, { color: Colors.text, marginTop: Spacing.sm }]}>
              From: {preview.shopperName}
              {[preview.shopperEmail, preview.shopperPhone].filter(Boolean).map((c) => ` · ${c}`).join('')}
            </Text>
            <Text style={[Type.bodyMedium, { color: Colors.text, marginTop: Spacing.sm }]}>“{preview.message}”</Text>
            {preview.expiresAt ? <Text style={[Type.labelSmall, { color: Colors.textMuted, marginTop: Spacing.sm }]}>Preview expires {preview.expiresAt}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[Type.titleSmall, { color: Colors.text }]}>Test Mode (Dry Run)</Text>
                <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>Validate and record without delivering to the dealer.</Text>
              </View>
              <Switch value={dryRun} onValueChange={setDryRun} trackColor={{ true: Brand.aquaDeep, false: Colors.divider }} thumbColor={dryRun ? Colors.accent : Colors.textMuted} />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
              <Button title="Edit" variant="outline" style={{ flex: 1 }} onPress={() => setFlow({ kind: 'idle' })} disabled={flow.kind === 'sending'} />
              <Button
                title={dryRun ? 'Run Test Inquiry' : 'Confirm & Send'}
                style={{ flex: 1 }}
                loading={flow.kind === 'sending'}
                onPress={() => confirmSend(preview)}
                testID="inquiry-confirm"
              />
            </View>
          </Card>
        ) : (
          <>
            <Field label="Your Full Name *" value={name} onChangeText={setName} autoComplete="name" />
            <Field label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label="Phone Number (optional if email provided)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
            <Field label="Message to Dealer *" value={message} onChangeText={(t) => setMessage(t.slice(0, 1800))} multiline />
            <Button
              title={flow.kind === 'preparing' ? 'Preparing verified preview…' : 'Preview Inquiry (Sends Nothing)'}
              loading={flow.kind === 'preparing'}
              disabled={!name.trim() || (!email.trim() && !phone.trim()) || !message.trim()}
              onPress={prepare}
              testID="inquiry-preview"
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
