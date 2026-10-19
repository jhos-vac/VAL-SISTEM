import type { ComponentProps, ReactNode } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatPercent } from '@val-sistem/shared';
import { InvertContext, radius, spacing, usePalettes, useTheme } from '@/lib/theme';
import { OfflineBanner } from './OfflineBanner';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Espacio al final para que la barra de pestañas flotante no tape contenido.
export const TAB_BAR_SPACE = 112;

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
  safeTop = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  // Para pantallas sin encabezado (respeta la barra de estado).
  safeTop?: boolean;
}) {
  const t = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
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
    <SafeAreaView
      edges={safeTop ? ['top', 'left', 'right'] : ['left', 'right']}
      style={{ flex: 1, backgroundColor: t.background }}
    >
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

// default: blanca (o verde bosque en oscuro); mint: menta suave;
// inverse: destacada, con la paleta opuesta para todo lo que tenga adentro.
export function Card({
  children,
  style,
  variant = 'default',
}: {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'mint' | 'inverse';
}) {
  const t = useTheme();
  const { inverse } = usePalettes();
  const backgroundColor =
    variant === 'inverse' ? inverse.emphasis : variant === 'mint' ? t.surfaceRaised : t.surface;
  const card = <View style={[styles.card, { backgroundColor }, style]}>{children}</View>;
  return variant === 'inverse' ? <InvertContext.Provider value>{card}</InvertContext.Provider> : card;
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

// Monto grande con los decimales atenuados ($12,788.56 → "56" más claro).
export function BigAmount({ text, size = 40 }: { text: string; size?: number }) {
  const t = useTheme();
  const match = /^(.*[.,])(\d{2})(\D*)$/.exec(text);
  return (
    <Text
      style={{ color: t.foreground, fontSize: size, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] }}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {match ? match[1] : text}
      {match ? (
        <Text style={{ color: t.textMuted, fontWeight: '600' }}>
          {match[2]}
          {match[3]}
        </Text>
      ) : null}
    </Text>
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

// Pastilla de variación (+0.8 % 24 h) con fondo suave.
export function ChangePill({ value, suffix }: { value: number; suffix?: string }) {
  const t = useTheme();
  const color = value > 0 ? t.pnlUp : value < 0 ? t.pnlDown : t.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Ionicons name={value >= 0 ? 'trending-up' : 'trending-down'} size={14} color={color} />
      <Text style={{ color, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {value > 0 ? '+' : ''}
        {formatPercent(value).replace(/^\+/, '')}
        {suffix ? ` ${suffix}` : ''}
      </Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
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
        {
          backgroundColor: bg,
          opacity: inactive ? 0.5 : 1,
          transform: [{ scale: pressed && !inactive ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Botón circular con ícono y etiqueta abajo (acciones rápidas del inicio).
export function ActionButton({
  icon,
  label,
  onPress,
  filled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1, flex: 1 })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? t.foreground : t.surface,
          borderWidth: filled ? 0 : 1.5,
          borderColor: t.foreground,
        }}
      >
        <Ionicons name={icon} size={22} color={filled ? t.background : t.foreground} />
      </View>
      <Text style={{ color: t.foreground, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

// Círculo con iniciales (usuario) o con la inicial de un activo.
export function Avatar({ text, size = 44, tone = 'mint' }: { text: string; size?: number; tone?: 'mint' | 'solid' }) {
  const t = useTheme();
  const initials = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'solid' ? t.primary : t.surfaceRaised,
      }}
    >
      <Text style={{ color: tone === 'solid' ? t.onPrimary : t.foreground, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

// Encabezado de sección con acción opcional a la derecha.
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: t.foreground, fontSize: 17, fontWeight: '700' }}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: '600' }}>{action} ›</Text>
        </Pressable>
      ) : null}
    </View>
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
            backgroundColor: t.surface,
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
          backgroundColor: selected ? t.foreground : t.surface,
          borderColor: selected ? t.foreground : t.border,
        },
      ]}
    >
      <Text style={{ color: selected ? t.background : t.foreground, fontSize: 14, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: TAB_BAR_SPACE },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  muted: { fontSize: 14 },
  body: { fontSize: 15 },
  card: { borderRadius: radius.lg, padding: spacing.lg + 2, gap: spacing.sm },
  statTile: { flex: 1, minWidth: 150, gap: spacing.xs },
  statLabel: { fontSize: 13 },
  statValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  number: { fontVariant: ['tabular-nums'], fontSize: 14 },
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16 },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 38,
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
