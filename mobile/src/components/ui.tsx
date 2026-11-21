import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Brand, Colors, Radius, Spacing, Type } from '@/theme';

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  testID,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  compact?: boolean;
}) {
  const isDisabled = disabled || loading;
  const fg = variant === 'primary' ? Colors.onAccent : variant === 'danger' ? Brand.passCoral : Colors.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary' && { backgroundColor: Colors.accent },
        (variant === 'outline' || variant === 'danger') && { borderWidth: 1, borderColor: variant === 'danger' ? Brand.passCoral : Colors.accent },
        isDisabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} size="small" style={{ marginRight: Spacing.sm }} /> : null}
      <Text style={[Type.labelLarge, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[Type.titleSmall, { color: selected ? Colors.onAccent : Colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={[Type.titleSmall, { color: Colors.textMuted, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={[Type.headlineLarge, { color: Colors.text }]}>{children}</Text>
    </View>
  );
}

export function Body({ children, muted, small }: { children: ReactNode; muted?: boolean; small?: boolean }) {
  return <Text style={[small ? Type.bodySmall : Type.bodyMedium, { color: muted ? Colors.textMuted : Colors.text }]}>{children}</Text>;
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'error'; title?: string; children: ReactNode }) {
  const color = tone === 'error' ? Brand.passCoral : tone === 'warn' ? Brand.amber : Colors.accent;
  return (
    <View style={[styles.notice, { borderColor: color }]}>
      {title ? <Text style={[Type.titleMedium, { color }]}>{title}</Text> : null}
      <Text style={[Type.bodySmall, { color: Colors.text }]}>{children}</Text>
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={[Type.labelSmall, { color: Colors.textMuted, marginBottom: 4 }]}>{label}</Text>
      <TextInput placeholderTextColor={Colors.textMuted} {...props} style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator color={Colors.accent} />
      {label ? <Text style={[Type.bodySmall, { color: Colors.textMuted, marginTop: Spacing.sm }]}>{label}</Text> : null}
    </Centered>
  );
}

export function SpecRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.specRow}>
      <Text style={[Type.bodySmall, { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[Type.labelMedium, { color: Colors.text, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: Spacing.md },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  chipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  notice: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
  },
  input: {
    ...Type.bodyMedium,
    color: Colors.text,
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
});
