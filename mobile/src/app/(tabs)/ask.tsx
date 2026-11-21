import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RvListRow } from '@/components/rv-card';
import { Button, Card, Chip, ChipRow, Notice } from '@/components/ui';
import { runAgentSearch } from '@/lib/ai/ask-ai';
import type { AiCuratedDeckResult } from '@/lib/ai/types';
import { errorMessage, formatCount } from '@/lib/format';
import { openRv } from '@/lib/nav';
import { applyDetailToSummary, hydrateUnits, useDiscover } from '@/state/discover';
import { askAiFallback, askAiPrimary, mcp } from '@/state/services';
import { useUserData } from '@/state/user-data';
import { Colors, Radius, Spacing, Type } from '@/theme';

const EXAMPLES = [
  'Class C under $60k within 200 miles of 80202 with a slide-out',
  'Travel trailer that sleeps 6, under 30 ft, I tow with a 2021 Ford F-150',
  'Used fifth wheel with a bunkhouse and outdoor kitchen under $50k',
];

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; result: AiCuratedDeckResult };

export default function AskAiScreen() {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const discover = useDiscover();
  const { saveRv, track } = useUserData();

  const run = async () => {
    setState({ kind: 'loading' });
    track('agent_search', { queryText: prompt.trim() });
    try {
      const result = await runAgentSearch(prompt, {
        primary: askAiPrimary,
        fallback: askAiFallback,
        search: (f) => mcp.searchRvs(f, [], 10),
      });
      setState({ kind: 'success', result });
      void hydrateUnits(result.curatedDeck, (unitId, detail) =>
        setState((s) =>
          s.kind === 'success'
            ? { ...s, result: { ...s.result, curatedDeck: s.result.curatedDeck.map((u) => (u.unitId === unitId ? applyDetailToSummary(u, detail) : u)) } }
            : s,
        ),
      );
    } catch (e) {
      setState({ kind: 'error', message: errorMessage(e, 'Ask AI could not complete your search.') });
    }
  };

  const dismiss = (unitId: string) =>
    setState((s) => (s.kind === 'success' ? { ...s, result: { ...s.result, curatedDeck: s.result.curatedDeck.filter((u) => u.unitId !== unitId) } } : s));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[Type.headlineLarge, { color: Colors.text }]}>Ask MatchRV AI</Text>
          <Text style={[Type.bodyMedium, { color: Colors.textMuted, marginBottom: Spacing.md }]}>
            Describe the RV you want in plain words. We turn it into filters and search live dealer inventory.
          </Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. Class C under $60k within 200 miles with a slide-out"
            placeholderTextColor={Colors.textMuted}
            multiline
            style={styles.input}
            testID="ask-ai-input"
          />
          <ChipRow>
            {EXAMPLES.map((e) => (
              <Chip key={e} label={e} onPress={() => setPrompt(e)} />
            ))}
          </ChipRow>
          <Button
            title={state.kind === 'loading' ? 'Curating live dealer RVs…' : 'Curate My Swipe Deck'}
            loading={state.kind === 'loading'}
            disabled={!prompt.trim()}
            onPress={run}
            style={{ marginTop: Spacing.lg }}
            testID="ask-ai-submit"
          />

          {state.kind === 'error' ? (
            <View style={{ marginTop: Spacing.lg }}>
              <Notice tone="error" title="Ask AI failed">{state.message}</Notice>
            </View>
          ) : null}

          {state.kind === 'success' ? (
            <View style={{ marginTop: Spacing.lg }}>
              {state.result.fallbackReason ? (
                <Notice tone="warn" title="Using on-device parser">
                  {`Gemini wasn't available (${state.result.fallbackReason}), so MatchRV parsed your request with its built-in keyword matcher.`}
                </Notice>
              ) : null}
              <Card>
                <Text style={[Type.labelSmall, { color: Colors.accent }]}>
                  {state.result.source === 'firebase-ai' ? askAiPrimary.label : askAiFallback.label}
                  {state.result.eligibleUnitsCount != null ? ` · searched ${formatCount(state.result.eligibleUnitsCount)} live RVs` : ''}
                </Text>
                <Text style={[Type.bodyLarge, { color: Colors.text, marginVertical: Spacing.sm }]}>{state.result.agentSummary}</Text>
                <ChipRow>
                  {state.result.appliedCriteriaChips.map((c) => (
                    <Chip key={c} label={c} selected />
                  ))}
                </ChipRow>
                <Text style={[Type.bodySmall, { color: Colors.textMuted, marginTop: Spacing.md }]}>Outfitter tip: {state.result.outfitterTip}</Text>
              </Card>

              {state.result.curatedDeck.length === 0 ? (
                <Notice tone="warn">No live matches for those criteria yet. Try widening budget or radius.</Notice>
              ) : (
                <>
                  <Button
                    title="Swipe Full Deck"
                    onPress={() => {
                      discover.loadAiDeck(state.result);
                      router.navigate('/');
                    }}
                    style={{ marginBottom: Spacing.md }}
                  />
                  {state.result.curatedDeck.map((rv) => (
                    <Card key={rv.unitId} style={{ paddingVertical: Spacing.sm }}>
                      <RvListRow rv={rv} onPress={() => openRv(rv.unitId)} />
                      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        <Button
                          title="Pass"
                          variant="danger"
                          compact
                          style={{ flex: 1 }}
                          onPress={() => {
                            track('swipe_left', { unitId: rv.unitId, rvType: rv.rvType, priceUsd: rv.priceUsd });
                            dismiss(rv.unitId);
                          }}
                        />
                        <Button
                          title="Save RV"
                          compact
                          style={{ flex: 1 }}
                          onPress={async () => {
                            if (await saveRv(rv, { fromSwipe: true })) dismiss(rv.unitId);
                          }}
                        />
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    ...Type.bodyLarge,
    color: Colors.text,
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
});
