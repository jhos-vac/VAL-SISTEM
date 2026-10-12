import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPercent } from '@val-sistem/shared';
import { radius, spacing, useTheme } from '@/lib/theme';
import { OfflineBanner } from './OfflineBanner';

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
}) {
  const t = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
      <OfflineBanner />
      {content}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.foreground }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[styles.muted, { color: t.textSecondary }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const t = useTheme();
  return <Text style={[styles.body, { color: t.foreground }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Card style={styles.statTile}>
      <Text style={[styles.statLabel, { color: t.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: t.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta}
    </Card>
  );
}

// Ganancia/pérdida: verde/rojo, con signo explícito para no depender
// solo del color.
export function PnlText({
  value,
  format,
  style,
}: {
  value: number;
  format: (n: number) => string;
  style?: TextStyle;
}) {
  const t = useTheme();
  const color = value > 0 ? t.pnlUp : value < 0 ? t.pnlDown : t.textSecondary;
  const sign = value > 0 ? '+' : '';
  return (
    <Text style={[styles.number, { color }, style]}>
      {sign}
      {format(value)}
    </Text>
  );
}

export function PercentText({ value, style }: { value: number; style?: TextStyle }) {
  return <PnlText value={value} format={(n) => formatPercent(n).replace(/^\+/, '')} style={style} />;
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : t.surfaceRaised;
  const fg = variant === 'primary' ? t.onPrimary : variant === 'danger' ? t.pnlDown : t.foreground;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[styles.fieldLabel, { color: t.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.textMuted}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            color: t.foreground,
            backgroundColor: t.surfaceRaised,
            borderColor: error ? t.pnlDown : t.border,
          },
        ]}
        {...props}
      />
      {error ? <Text style={{ color: t.pnlDown, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text accessibilityRole="alert" style={{ color: t.pnlDown, fontSize: 14 }}>
      {children}
    </Text>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={t.primary} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? t.primary : t.surfaceRaised,
          borderColor: selected ? t.primary : t.border,
        },
      ]}
    >
      <Text style={{ color: selected ? t.onPrimary : t.foreground, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 24, fontWeight: '700' },
  muted: { fontSize: 14 },
  body: { fontSize: 15 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  statTile: { flex: 1, minWidth: 150, gap: spacing.xs },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  number: { fontVariant: ['tabular-nums'], fontSize: 14 },
  button: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonText: { fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
