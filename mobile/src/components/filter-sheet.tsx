// Filter sheet — same fields as FilterBottomSheet.kt. Sliders (radius, max length) are rendered as
// stepped chip rows because React Native core has no slider component.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  RV_CONDITION_OPTIONS,
  RV_FEATURE_OPTIONS,
  RV_SORT_OPTIONS,
  RV_TYPE_OPTIONS,
  type RvSearchFilter,
} from '@/lib/models/rv';
import { Colors, Radius, Spacing, Type } from '@/theme';

import { EMPTY_FORM, buildFilterFromForm, formFromFilter, type FilterForm } from '@/lib/logic/filter-form';

import { Button, Chip, ChipRow, Field, SectionLabel } from './ui';

const RADIUS_STEPS = [25, 50, 100, 200, 500, 1000];
const LENGTH_STEPS: (number | null)[] = [null, 20, 25, 30, 35, 40, 45];
const SLEEPS_STEPS: [number, string][] = [[0, 'Any'], [2, '2+'], [4, '4+'], [6, '6+'], [8, '8+']];
const PRICE_PRESETS: [number, string][] = [[30000, 'Under $30k'], [60000, 'Under $60k'], [100000, 'Under $100k']];

const digits = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function FilterSheet({
  visible,
  filter,
  onDismiss,
  onApply,
  onSaveAlert,
}: {
  visible: boolean;
  filter: RvSearchFilter;
  onDismiss: () => void;
  onApply: (f: RvSearchFilter) => void;
  onSaveAlert: (f: RvSearchFilter) => void;
}) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FilterForm>(() => formFromFilter(filter));
  const [lastFilter, setLastFilter] = useState(filter);
  if (filter !== lastFilter) {
    // re-seed the form when the applied filter changes (like remember(currentFilter) in Compose)
    setLastFilter(filter);
    setForm(formFromFilter(filter));
  }
  const set = <K extends keyof FilterForm>(k: K, v: FilterForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const built = () => buildFilterFromForm(filter, form);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Close filters" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.header}>
          <Text style={[Type.headlineMedium, { color: Colors.text }]}>Filter RVs</Text>
          <Pressable onPress={() => setForm(EMPTY_FORM)} accessibilityRole="button">
            <Text style={[Type.labelLarge, { color: Colors.accent }]}>Reset</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.lg }} keyboardShouldPersistTaps="handled">
          <SectionLabel>RV Type</SectionLabel>
          <ChipRow>
            {RV_TYPE_OPTIONS.map((o) => (
              <Chip key={o.wireValue} label={o.displayLabel} selected={form.rvTypes.includes(o.wireValue)} onPress={() => set('rvTypes', toggle(form.rvTypes, o.wireValue))} />
            ))}
          </ChipRow>

          <SectionLabel>Price Range</SectionLabel>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Min $" value={form.priceMin} onChangeText={(t) => set('priceMin', digits(t, 7))} keyboardType="number-pad" testID="filter_price_min_input" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Max $" value={form.priceMax} onChangeText={(t) => set('priceMax', digits(t, 7))} keyboardType="number-pad" testID="filter_price_max_input" />
            </View>
          </View>
          <ChipRow>
            {PRICE_PRESETS.map(([v, l]) => (
              <Chip key={v} label={l} selected={form.priceMax === String(v)} onPress={() => set('priceMax', String(v))} />
            ))}
          </ChipRow>

          <SectionLabel>Location</SectionLabel>
          <Field label="City, State, or ZIP (e.g. Austin, TX)" value={form.location} onChangeText={(t) => set('location', t.slice(0, 80))} autoCapitalize="words" />
          {form.location.trim() ? (
            <>
              <Text style={[Type.labelMedium, { color: Colors.textMuted }]}>Search radius: {form.radiusMiles} miles</Text>
              <ChipRow>
                {RADIUS_STEPS.map((r) => (
                  <Chip key={r} label={`${r} mi`} selected={form.radiusMiles === r} onPress={() => set('radiusMiles', r)} />
                ))}
              </ChipRow>
            </>
          ) : null}

          <SectionLabel>Condition</SectionLabel>
          <ChipRow>
            {RV_CONDITION_OPTIONS.map((o) => (
              <Chip key={o.wireValue} label={o.displayLabel} selected={form.condition === o.wireValue} onPress={() => set('condition', o.wireValue)} />
            ))}
          </ChipRow>

          <SectionLabel>Minimum Sleeps: {form.sleepsMin === 0 ? 'Any' : `${form.sleepsMin}+`}</SectionLabel>
          <ChipRow>
            {SLEEPS_STEPS.map(([n, l]) => (
              <Chip key={n} label={l} selected={form.sleepsMin === n} onPress={() => set('sleepsMin', n)} />
            ))}
          </ChipRow>

          <SectionLabel>{form.lengthMaxFt == null ? 'Max Length: Any' : `Max Length: ${form.lengthMaxFt} ft`}</SectionLabel>
          <ChipRow>
            {LENGTH_STEPS.map((l) => (
              <Chip key={String(l)} label={l == null ? 'Any' : `${l} ft`} selected={form.lengthMaxFt === l} onPress={() => set('lengthMaxFt', l)} />
            ))}
          </ChipRow>

          <SectionLabel>Tow Vehicle & Rating (Optional)</SectionLabel>
          <Field label="Tow vehicle (e.g. 2023 Ford F-150 3.5L)" value={form.towVehicle} onChangeText={(t) => set('towVehicle', t.slice(0, 120))} />
          <Field label="Max tow rating (lbs)" value={form.towRating} onChangeText={(t) => set('towRating', digits(t, 5))} keyboardType="number-pad" />

          <SectionLabel>Preferred Features</SectionLabel>
          <ChipRow>
            {RV_FEATURE_OPTIONS.map((o) => (
              <Chip key={o.wireValue} label={o.displayLabel} selected={form.features.includes(o.wireValue)} onPress={() => set('features', toggle(form.features, o.wireValue))} />
            ))}
          </ChipRow>

          <SectionLabel>Sort By (Includes Newest Model Year)</SectionLabel>
          <ChipRow>
            {RV_SORT_OPTIONS.map((o) => (
              <Chip key={o.wireValue} label={o.displayLabel} selected={form.sort === o.wireValue} onPress={() => set('sort', o.wireValue)} />
            ))}
          </ChipRow>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Save Alert" variant="outline" style={{ flex: 1 }} onPress={() => onSaveAlert(built())} testID="filter_save_alert_button" />
          <Button
            title="Apply Filters"
            style={{ flex: 1 }}
            testID="filter_apply_button"
            onPress={() => {
              onApply(built());
              onDismiss();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  footer: { flexDirection: 'row', gap: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider },
});
