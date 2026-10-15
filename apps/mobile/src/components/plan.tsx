// Componentes de las pantallas de planificación (metas, estrategia, DCA,
// explorar): barra de progreso animada, selector de activos y control +/-.
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchAssets, fetchCapitalAssets } from '@/lib/plan-clients';
import { radius, spacing, useTheme } from '@/lib/theme';
import { Chip, Muted } from './ui';

// Misma paleta categórica que la web (chart-colors.ts).
export const SERIES = ['#3B82F6', '#F5A623', '#0ECB81', '#A78BFA', '#F472B6', '#22D3EE', '#FB923C', '#F6465D'];

export function colorAt(symbol: string, order: string[]): string {
  const i = order.indexOf(symbol);
  return SERIES[(i < 0 ? order.length : i) % SERIES.length];
}

// Barra de progreso que se anima al cambiar de valor.
export function ProgressBar({
  value,
  color,
  label,
  height = 8,
}: {
  value: number; // 0..1
  color?: string;
  label: string;
  height?: number;
}) {
  const t = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  const [anim] = useState(() => new Animated.Value(0));
  const width = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [anim],
  );
  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 700, useNativeDriver: false }).start();
  }, [anim, clamped]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height, borderRadius: height, backgroundColor: t.surfaceRaised, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height,
          backgroundColor: color ?? t.primary,
          width,
        }}
      />
    </View>
  );
}

// Control +/- con valor numérico (para %). Toca para sumar o restar el paso.
export function Stepper({
  value,
  onChange,
  step = 5,
  max = 100,
  suffix = '%',
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  suffix?: string;
  label: string;
}) {
  const t = useTheme();
  const btn = (text: string, delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Sumar' : 'Restar'} ${step}${suffix} a ${label}`}
      onPress={() => onChange(Math.min(max, Math.max(0, Math.round((value + delta) * 100) / 100)))}
      disabled={disabled}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.sm,
        backgroundColor: t.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: t.foreground, fontSize: 20, fontWeight: '600' }}>{text}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {btn('−', -step, value <= 0)}
      <Text style={{ color: t.foreground, minWidth: 64, textAlign: 'center', fontSize: 16, fontVariant: ['tabular-nums'] }}>
        {value.toFixed(value % 1 === 0 ? 0 : 2)}
        {suffix}
      </Text>
      {btn('+', step, value >= max)}
    </View>
  );
}

// Selector de activos en línea: busca entre "Tus activos" (con su % actual)
// y el resto del catálogo. Nunca ofrece monedas capital ni las excluidas.
export function AssetSelector({
  held,
  exclude,
  onPick,
}: {
  held: { symbol: string; currentPercent?: number }[];
  exclude: string[];
  onPick: (symbol: string) => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const { data: catalog } = useQuery({ queryKey: ['market-assets'], queryFn: fetchAssets, staleTime: 600_000 });
  const { data: capital } = useQuery({ queryKey: ['capital-assets'], queryFn: fetchCapitalAssets });

  const excluded = useMemo(() => new Set([...exclude, ...(capital ?? [])]), [exclude, capital]);
  const q = query.trim().toLowerCase();
  const names = useMemo(() => new Map((catalog ?? []).map((a) => [a.symbol, a.name])), [catalog]);
  const matches = (s: string) => !q || s.toLowerCase().includes(q) || (names.get(s) ?? '').toLowerCase().includes(q);
  const heldSet = new Set(held.map((h) => h.symbol));
  const heldOptions = held.filter((h) => !excluded.has(h.symbol) && matches(h.symbol));
  const others = (catalog ?? [])
    .filter((a) => !excluded.has(a.symbol) && !heldSet.has(a.symbol) && matches(a.symbol))
    .slice(0, 30);

  return (
    <View style={{ gap: spacing.sm }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar moneda…"
        placeholderTextColor={t.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Buscar moneda"
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          color: t.foreground,
          backgroundColor: t.surfaceRaised,
        }}
      />
      {heldOptions.length > 0 ? (
        <>
          <Muted style={{ fontSize: 12 }}>Tus activos</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {heldOptions.map((h) => (
              <Chip
                key={h.symbol}
                label={h.currentPercent !== undefined ? `${h.symbol} · ${h.currentPercent.toFixed(0)}%` : h.symbol}
                selected={false}
                onPress={() => onPick(h.symbol)}
              />
            ))}
          </View>
        </>
      ) : null}
      {others.length > 0 ? (
        <>
          <Muted style={{ fontSize: 12 }}>Otras monedas</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {others.map((a) => (
              <Chip key={a.symbol} label={a.symbol} selected={false} onPress={() => onPick(a.symbol)} />
            ))}
          </View>
        </>
      ) : null}
      {heldOptions.length === 0 && others.length === 0 ? (
        <Muted>{catalog ? 'No hay coincidencias.' : 'Cargando monedas…'}</Muted>
      ) : null}
    </View>
  );
}

// Encabezado de sección dentro de una pantalla.
export function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
