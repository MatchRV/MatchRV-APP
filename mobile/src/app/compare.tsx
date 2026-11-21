import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Loading, Notice } from '@/components/ui';
import { errorMessage, formatLength, formatPrice, formatWeight } from '@/lib/format';
import type { RvComparisonResult } from '@/lib/models/rv';
import { openRv } from '@/lib/nav';
import { mcp } from '@/state/services';
import { useUserData } from '@/state/user-data';
import { Colors, Spacing, Type } from '@/theme';

const COL = 150;

function cell(v: string | number | boolean | null, unit: string): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') {
    if (unit === 'USD') return formatPrice(v);
    return `${v.toLocaleString('en-US')}${unit && unit !== '/100' ? ` ${unit}` : unit}`;
  }
  return v;
}

export default function CompareScreen() {
  const { compareIds, savedRvs } = useUserData();
  const enough = compareIds.length >= 2;
  const [result, setResult] = useState<RvComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(enough ? null : 'Select at least 2 saved RVs to compare');
  const [loading, setLoading] = useState(enough);

  const onDone = useCallback((r: RvComparisonResult) => {
    setResult(r);
    setLoading(false);
  }, []);
  const onFail = useCallback((e: unknown) => {
    setError(errorMessage(e, 'Compare failed'));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (compareIds.length < 2) return;
    let active = true;
    mcp.compareRvs(compareIds).then(
      (r) => active && onDone(r),
      (e) => active && onFail(e),
    );
    return () => {
      active = false;
    };
  }, [compareIds, onDone, onFail]);

  const run = () => {
    if (!enough) return;
    setError(null);
    setLoading(true);
    mcp.compareRvs(compareIds).then(onDone, onFail);
  };

  if (loading && !result) return <Loading label="Comparing on live MatchRV data…" />;

  const titles = result?.rows.map((r) => r.title) ?? compareIds.map((id) => savedRvs.data.find((s) => s.unitId === id)?.title ?? id);

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
      {error ? (
        <>
          <Notice tone="error">{error}</Notice>
          <Button title="Retry" onPress={run} />
        </>
      ) : null}
      {result ? (
        <>
          <Text style={[Type.bodyMedium, { color: Colors.textMuted, marginBottom: Spacing.md }]}>{result.summaryText}</Text>
          <ScrollView horizontal>
            <View>
              <View style={styles.row}>
                <Text style={[styles.label, Type.labelSmall]}>RV</Text>
                {result.rows.map((r, i) => (
                  <Text key={r.unitId || i} style={[styles.cell, Type.titleSmall, { color: Colors.accent }]} onPress={() => openRv(r.unitId)} numberOfLines={3}>
                    {titles[i]}
                  </Text>
                ))}
              </View>
              {result.specRows.length > 0
                ? result.specRows.map((row) => (
                    <View key={row.spec} style={styles.row}>
                      <Text style={[styles.label, Type.labelSmall]}>{row.spec}</Text>
                      {row.values.map((v, i) => (
                        <Text key={i} style={[styles.cell, Type.bodySmall, row.bestIndex === i && { color: Colors.accent, fontWeight: '700' }]}>
                          {cell(v, row.unit)}
                        </Text>
                      ))}
                    </View>
                  ))
                : (
                    [
                      ['Price', (i: number) => formatPrice(result.rows[i].priceUsd)],
                      ['Length', (i: number) => formatLength(result.rows[i].lengthFt) ?? '—'],
                      ['Sleeps', (i: number) => (result.rows[i].sleeps != null ? String(result.rows[i].sleeps) : '—')],
                      ['Dry weight', (i: number) => formatWeight(result.rows[i].dryWeightLbs) ?? '—'],
                      ['GVWR', (i: number) => formatWeight(result.rows[i].gvwrLbs) ?? '—'],
                      ['Dealer', (i: number) => result.rows[i].dealer],
                      ['Highlights', (i: number) => result.rows[i].highlights.join('\n') || '—'],
                    ] as [string, (i: number) => string][]
                  ).map(([label, fn]) => (
                    <View key={label} style={styles.row}>
                      <Text style={[styles.label, Type.labelSmall]}>{label}</Text>
                      {result.rows.map((r, i) => (
                        <Text key={r.unitId || i} style={[styles.cell, Type.bodySmall]}>
                          {fn(i)}
                        </Text>
                      ))}
                    </View>
                  ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider, paddingVertical: 8 },
  label: { width: 110, color: Colors.textMuted, textTransform: 'capitalize' },
  cell: { width: COL, color: Colors.text, paddingRight: Spacing.sm },
});
