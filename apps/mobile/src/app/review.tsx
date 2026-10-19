import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import {
  buildReview,
  COST_SOURCE_LABELS,
  formatCurrency,
  formatPercent,
  type ReviewRow,
} from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { Body, Card, ChangePill, Chip, ErrorText, Loading, Muted, PnlText, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions } from '@/lib/clients';
import { onColor, radius, SERIES, spacing, useTheme } from '@/lib/theme';

type Order = 'up' | 'down' | 'value' | 'alpha';
const ORDERS: { value: Order; label: string }[] = [
  { value: 'up', label: 'Más subieron' },
  { value: 'down', label: 'Más bajaron' },
  { value: 'value', label: 'Mayor valor' },
  { value: 'alpha', label: 'A-Z' },
];

function sortRows(rows: ReviewRow[], order: Order): ReviewRow[] {
  const copy = [...rows];
  if (order === 'up') return copy.sort((a, b) => b.changePercent - a.changePercent);
  if (order === 'down') return copy.sort((a, b) => a.changePercent - b.changePercent);
  if (order === 'value') return copy.sort((a, b) => b.value - a.value);
  return copy.sort((a, b) => a.assetSymbol.localeCompare(b.assetSymbol));
}

// Revisión general: cuánto subió o bajó cada moneda desde su precio de
// compra, que queda fijo.
export default function ReviewScreen() {
  const t = useTheme();
  const { portfolio } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const [order, setOrder] = useState<Order>('up');

  const positions = useQuery({
    queryKey: ['positions', portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });
  const review = useMemo(() => buildReview(positions.data ?? []), [positions.data]);
  const rows = useMemo(() => sortRows(review.rows, order), [review.rows, order]);
  const { summary } = review;

  return (
    <Screen onRefresh={() => void positions.refetch()} refreshing={positions.isRefetching}>
      <PortfolioHeader />
      {positions.isLoading ? <Loading /> : null}
      {positions.error && !positions.data ? <ErrorText>{positions.error.message}</ErrorText> : null}

      {positions.data && review.rows.length === 0 ? (
        <Card>
          <Muted>Todavía no hay monedas para revisar en este portafolio.</Muted>
        </Card>
      ) : null}

      {review.rows.length > 0 ? (
        <>
          <Card variant="inverse">
            <Muted style={{ fontSize: 13 }}>Ganancia o pérdida desde la compra</Muted>
            <PnlText value={summary.pnl} format={money} style={{ fontSize: 32, fontWeight: '700', letterSpacing: -0.5 }} />
            <ChangePill value={summary.pnlPercent} />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12 }}>Pagaste</Muted>
                <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(summary.invested)}</Body>
              </View>
              <View style={{ flex: 1 }}>
                <Muted style={{ fontSize: 12 }}>Vale hoy</Muted>
                <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{money(summary.value)}</Body>
              </View>
            </View>
            <Row style={{ marginTop: spacing.xs }}>
              <Counter icon="trending-up" color={t.pnlUp} label={`${summary.up} subieron`} />
              <Counter icon="trending-down" color={t.pnlDown} label={`${summary.down} bajaron`} />
            </Row>
          </Card>

          {summary.best || summary.worst ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {summary.best ? <Highlight title="La que más subió" row={summary.best} /> : null}
              {summary.worst ? <Highlight title="La que más bajó" row={summary.worst} /> : null}
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {ORDERS.map((o) => (
              <Chip key={o.value} label={o.label} selected={order === o.value} onPress={() => setOrder(o.value)} />
            ))}
          </ScrollView>

          {rows.map((r, i) => (
            <CoinCard key={r.assetSymbol} row={r} color={SERIES[i % SERIES.length]!} money={money} />
          ))}

          <Muted style={{ fontSize: 12 }}>
            El precio de compra queda fijo: sale de tus compras en Binance o, si la moneda llegó por depósito,
            conversión o tarjeta, del precio que tenía en ese momento. Si no hay registro, del día en que se conectó.
          </Muted>
        </>
      ) : null}
    </Screen>
  );
}

function Counter({ icon, color, label }: { icon: 'trending-up' | 'trending-down'; color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: t.foreground, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function Highlight({ title, row }: { title: string; row: ReviewRow }) {
  return (
    <Card variant="mint" style={{ flex: 1, gap: 4 }}>
      <Muted style={{ fontSize: 12 }}>{title}</Muted>
      <Body style={{ fontWeight: '700', fontSize: 18 }}>{row.assetSymbol}</Body>
      <ChangePill value={row.changePercent} />
    </Card>
  );
}

function CoinCard({ row, color, money }: { row: ReviewRow; color: string; money: (n: number) => string }) {
  const t = useTheme();
  const up = row.changePercent >= 0;
  // Barra de cambio: llena hasta ±100 %.
  const magnitude = Math.min(Math.abs(row.changePercent), 100);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: onColor(color), fontWeight: '700' }}>{row.assetSymbol.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: '700' }}>{row.assetSymbol}</Body>
          <Muted style={{ fontSize: 12 }} >{row.assetName}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: up ? t.pnlUp : t.pnlDown, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {up ? '+' : ''}
            {formatPercent(row.changePercent).replace(/^\+/, '')}
          </Text>
          <PnlText value={row.pnl} format={money} style={{ fontSize: 13 }} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: t.surfaceRaised, overflow: 'hidden' }}>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
          {!up ? <View style={{ width: `${magnitude}%`, backgroundColor: t.pnlDown, borderRadius: 4 }} /> : null}
        </View>
        <View style={{ width: 2, backgroundColor: t.textMuted }} />
        <View style={{ flex: 1 }}>
          {up ? <View style={{ width: `${magnitude}%`, height: '100%', backgroundColor: t.pnlUp, borderRadius: 4 }} /> : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Muted style={{ fontSize: 12 }}>Precio de compra (fijo)</Muted>
          <Body style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{money(row.buyPrice)}</Body>
        </View>
        <Ionicons name="arrow-forward" size={16} color={t.textMuted} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Muted style={{ fontSize: 12 }}>Precio hoy</Muted>
          <Body style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{money(row.currentPrice)}</Body>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
        <View style={{ backgroundColor: t.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }}>
          <Text style={{ color: t.foreground, fontSize: 11, fontWeight: '600' }}>{COST_SOURCE_LABELS[row.costSource]}</Text>
        </View>
        {row.costFixedAt ? (
          <Muted style={{ fontSize: 11 }}>desde {new Date(row.costFixedAt).toLocaleDateString('es-EC')}</Muted>
        ) : null}
        <Muted style={{ fontSize: 11, marginLeft: 'auto' }}>
          24 h {row.change24h >= 0 ? '+' : ''}
          {formatPercent(row.change24h).replace(/^\+/, '')}
        </Muted>
      </View>
    </Card>
  );
}
