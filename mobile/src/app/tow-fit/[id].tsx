// Tow-fit check — same inputs as the Kotlin detail screen: tow vehicle + optional door-sticker payload.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { Button, Card, Field, Notice } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import type { TowFitEvaluation } from '@/lib/models/rv';
import { mcp } from '@/state/services';
import { Brand, Colors, Spacing, Type } from '@/theme';

function verdictColor(v: string) {
  const s = v.toLowerCase();
  if (s.includes('exceed') || s.includes('over') || s.includes('no_fit') || s.includes('not')) return Brand.passCoral;
  if (s.includes('depend') || s.includes('verify') || s.includes('tight') || s.includes('unknown')) return Brand.amber;
  return Colors.accent;
}

export default function TowFitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitId = String(id ?? '');
  const cached = mcp.getCachedDetail(unitId);
  const [vehicle, setVehicle] = useState('');
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TowFitEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = Number(payload);
      setResult(await mcp.evaluateTowFit({ unitIds: [unitId], vehicle, truckPayloadLbs: payload && p > 0 ? p : null }));
    } catch (e) {
      setError(errorMessage(e, 'Tow-fit check failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
        {cached ? <Text style={[Type.titleLarge, { color: Colors.text, marginBottom: Spacing.md }]}>{cached.title}</Text> : null}
        <Field label="Your tow vehicle (e.g. 2022 Ford F-150 3.5L)" value={vehicle} onChangeText={(t) => setVehicle(t.slice(0, 120))} testID="tow-vehicle" />
        <Field label="Door-sticker payload lbs (optional)" value={payload} onChangeText={(t) => setPayload(t.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" />
        <Button title={busy ? 'Evaluating weight limits…' : 'Evaluate Tow Fit via MatchRV'} loading={busy} disabled={!vehicle.trim()} onPress={run} />
        {error ? (
          <Notice tone="error" title="Tow-fit check failed">
            {error}
          </Notice>
        ) : null}
        {result ? (
          <Card style={{ marginTop: Spacing.lg }}>
            <Text style={[Type.labelSmall, { color: Colors.textMuted }]}>Vehicle</Text>
            <Text style={[Type.titleMedium, { color: Colors.text, marginBottom: Spacing.sm }]}>{result.vehicleLabel}</Text>
            {result.unitVerdicts.map((v) => (
              <Card key={v.unitId || v.title} style={{ backgroundColor: Colors.surfaceRaised }}>
                <Text style={[Type.titleSmall, { color: Colors.text }]}>{v.title}</Text>
                <Text style={[Type.labelLarge, { color: verdictColor(v.verdict), textTransform: 'capitalize' }]}>{v.verdict.replace(/_/g, ' ')}</Text>
                {v.details.map((line) => (
                  <Text key={line} style={[Type.bodySmall, { color: Colors.textMuted }]}>• {line}</Text>
                ))}
              </Card>
            ))}
            <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{result.summaryText}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
