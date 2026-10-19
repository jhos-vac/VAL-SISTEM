import { useMemo, useState } from 'react';
import { Appearance, Pressable, Text, useColorScheme, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, type AssetAllocation, type PerformancePoint } from '@val-sistem/shared';
import {
  ActionButton,
  Avatar,
  BigAmount,
  Body,
  Card,
  ChangePill,
  Chip,
  ErrorText,
  Loading,
  Muted,
  PnlText,
  Row,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchAllocation, fetchPerformance, fetchSummary } from '@/lib/clients';
import { onColor, radius, SERIES, spacing, useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';

type Range = 7 | 30 | 0;
const RANGES: { value: Range; label: string }[] = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 0, label: 'Todo' },
];

function greeting(hour: number): string {
  if (hour < 12) return 'Buen día';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function DashboardScreen() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
  const { portfolio, hasNone, isLoading, isAggregate } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const [hour] = useState(() => new Date().getHours());
  // TEMPORAL: botón para probar el modo claro/oscuro sin cambiar el del
  // teléfono. Quitar cuando exista el selector de tema en Ajustes.
  const isDark = useColorScheme() === 'dark';

  const summary = useQuery({
    queryKey: ['portfolio-summary', portfolio?.id],
    queryFn: () => fetchSummary(portfolio!.id),
    enabled: !!portfolio,
  });
  const allocation = useQuery({
    queryKey: ['portfolio-allocation', portfolio?.id],
    queryFn: () => fetchAllocation(portfolio!.id),
    enabled: !!portfolio,
  });
  const performance = useQuery({
    queryKey: ['portfolio-performance', portfolio?.id],
    queryFn: () => fetchPerformance(portfolio!.id),
    enabled: !!portfolio,
  });

  const refresh = () => {
    void summary.refetch();
    void allocation.refetch();
    void performance.refetch();
  };

  return (
    <Screen safeTop onRefresh={refresh} refreshing={summary.isRefetching}>
      <Row>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
          <Avatar text={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
              Hola, {user?.firstName ?? 'inversor'}!
            </Text>
            <Muted style={{ fontSize: 13 }}>{greeting(hour)}</Muted>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          onPress={() => Appearance.setColorScheme(isDark ? 'light' : 'dark')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.foreground,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.sm,
          }}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={t.background} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar de portafolio"
          onPress={() => router.push('/portfolios')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: t.foreground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="briefcase-outline" size={20} color={t.foreground} />
        </Pressable>
      </Row>

      {isLoading ? <Loading /> : null}
      {hasNone ? (
        <Card>
          <Muted>Todavía no tenés portafolios. Creá el primero desde la web.</Muted>
        </Card>
      ) : null}
      {summary.error && !summary.data ? <ErrorText>{summary.error.message}</ErrorText> : null}

      {summary.data ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Portafolio ${portfolio?.name ?? ''}. Cambiar`}
            onPress={() => router.push('/portfolios')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Muted style={{ fontSize: 13 }}>Valor de {portfolio?.name ?? 'tu portafolio'}</Muted>
            <Ionicons name="chevron-down" size={14} color={t.textSecondary} />
          </Pressable>
          <BigAmount text={money(summary.data.totalValue)} size={42} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <ChangePill value={summary.data.changePercent24h} suffix="24 h" />
            {summary.data.capitalValue > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: radius.pill,
                  backgroundColor: t.surfaceRaised,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 6,
                }}
              >
                <Ionicons name="wallet-outline" size={14} color={t.foreground} />
                <Text style={{ color: t.foreground, fontSize: 13, fontWeight: '600' }}>
                  Capital {money(summary.data.capitalValue)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {portfolio ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <ActionButton
            icon="add"
            label="Registrar"
            filled
            onPress={() => router.push(isAggregate ? '/portfolios' : '/transaction-new')}
          />
          <ActionButton icon="trending-up" label="Mercado" onPress={() => router.push('/market')} />
          <ActionButton icon="flag-outline" label="Metas" onPress={() => router.push('/goals')} />
          <ActionButton icon="compass-outline" label="Estrategia" onPress={() => router.push('/strategy')} />
        </View>
      ) : null}

      {summary.data ? (
        <PerformanceCard
          points={performance.data ?? []}
          money={money}
          unrealized={summary.data.unrealizedPnl}
          realized={summary.data.realizedPnl}
        />
      ) : null}

      {allocation.data && allocation.data.length > 0 ? (
        <AssetsCard items={allocation.data} money={money} />
      ) : null}

      {summary.data ? (
        <Muted style={{ fontSize: 12, textAlign: 'center' }}>
          Actualizado {new Date(summary.data.asOf).toLocaleString('es-EC')}
        </Muted>
      ) : null}
    </Screen>
  );
}

// Tarjeta menta con barras del valor del portafolio (snapshots) y las
// ganancias.
function PerformanceCard({
  points,
  money,
  unrealized,
  realized,
}: {
  points: PerformancePoint[];
  money: (n: number) => string;
  unrealized: number;
  realized: number;
}) {
  const t = useTheme();
  const [range, setRange] = useState<Range>(7);
  const [selected, setSelected] = useState<number | null>(null);
  const bars = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const sliced = range === 0 ? sorted : sorted.slice(-range);
    // Como mucho 12 barras: si hay más puntos, se toma uno de cada tanto.
    const step = Math.max(1, Math.ceil(sliced.length / 12));
    return sliced.filter((_, i) => (sliced.length - 1 - i) % step === 0);
  }, [points, range]);
  const values = bars.map((b) => b.totalValue);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const floor = min - (max - min) * 0.6;
  const active = selected !== null && selected < bars.length ? selected : bars.length - 1;
  const first = bars[0]?.totalValue ?? 0;
  const change = first > 0 && bars.length > 1 ? ((bars[bars.length - 1]!.totalValue - first) / first) * 100 : null;

  return (
    <Card variant="mint">
      <Row>
        <Body style={{ fontWeight: '700', fontSize: 16 }}>Rendimiento</Body>
        {change !== null ? <ChangePill value={change} /> : null}
      </Row>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {RANGES.map((r) => (
          <Chip
            key={r.value}
            label={r.label}
            selected={range === r.value}
            onPress={() => {
              setRange(r.value);
              setSelected(null);
            }}
          />
        ))}
      </View>
      {bars.length < 2 ? (
        <Muted style={{ fontSize: 13 }}>Todavía no hay historial suficiente: se guarda una foto del valor cada hora.</Muted>
      ) : (
        <>
          <Text style={{ color: t.foreground, fontSize: 13, fontWeight: '600' }}>
            {new Date(bars[active]!.date).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} ·{' '}
            {money(bars[active]!.totalValue)}
          </Text>
          <View
            accessibilityLabel="Gráfico del valor del portafolio"
            style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 }}
          >
            {bars.map((b, i) => {
              const h = max === floor ? 1 : (b.totalValue - floor) / (max - floor);
              const isActive = i === active;
              return (
                <Pressable
                  key={b.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${new Date(b.date).toLocaleDateString('es-EC')}: ${money(b.totalValue)}`}
                  onPress={() => setSelected(i)}
                  style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
                >
                  <View
                    style={{
                      height: `${Math.max(8, h * 100)}%`,
                      borderRadius: 10,
                      backgroundColor: isActive ? t.foreground : t.accent,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <View style={{ height: 1, backgroundColor: t.border, marginVertical: spacing.xs }} />
      <Row>
        <Muted>Ganancia no realizada</Muted>
        <PnlText value={unrealized} format={money} style={{ fontWeight: '700', fontSize: 15 }} />
      </Row>
      <Row>
        <Muted>Ganancia realizada</Muted>
        <PnlText value={realized} format={money} style={{ fontWeight: '700', fontSize: 15 }} />
      </Row>
    </Card>
  );
}

// Tarjeta destacada (verde noche) con los activos del portafolio.
function AssetsCard({ items, money }: { items: AssetAllocation[]; money: (n: number) => string }) {
  const t = useTheme();
  return (
    <Card variant="inverse" style={{ gap: spacing.md }}>
      <InverseList items={items} money={money} />
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/positions')} hitSlop={8}>
        <Text style={{ color: t.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
          Ver posiciones
        </Text>
      </Pressable>
    </Card>
  );
}

function InverseList({ items, money }: { items: AssetAllocation[]; money: (n: number) => string }) {
  const t = useTheme();
  return (
    <>
      <SectionHeader title="Tus activos" />
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {items.map((a, i) => (
          <View key={a.assetSymbol} style={{ flex: Math.max(a.percentage, 0.5), backgroundColor: SERIES[i % SERIES.length] }} />
        ))}
      </View>
      {items.slice(0, 6).map((a, i) => (
        <View
          key={a.assetSymbol}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            backgroundColor: t.surfaceRaised,
            borderRadius: radius.md,
            padding: spacing.md,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: SERIES[i % SERIES.length],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: onColor(SERIES[i % SERIES.length]!), fontWeight: '700' }}>{a.assetSymbol.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '700' }}>{a.assetSymbol}</Body>
            <Muted style={{ fontSize: 12 }}>{a.percentage.toFixed(1)}% del portafolio</Muted>
          </View>
          <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(a.valueInBaseCurrency)}</Body>
        </View>
      ))}
    </>
  );
}
