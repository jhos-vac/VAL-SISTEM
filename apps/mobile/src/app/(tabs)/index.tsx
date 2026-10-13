import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import {
  Body,
  Card,
  ErrorText,
  Loading,
  Muted,
  PercentText,
  PnlText,
  Row,
  Screen,
  StatTile,
} from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchAllocation, fetchSummary } from '@/lib/clients';
import { radius, spacing, useTheme } from '@/lib/theme';

const SERIES = ['#3B82F6', '#F5A623', '#0ECB81', '#A78BFA', '#F472B6', '#22D3EE'];

export default function DashboardScreen() {
  const t = useTheme();
  const { portfolio, hasNone, isLoading } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';

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

  const refresh = () => {
    void summary.refetch();
    void allocation.refetch();
  };
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <Screen onRefresh={refresh} refreshing={summary.isRefetching}>
      <PortfolioHeader />
      {isLoading ? <Loading /> : null}
      {hasNone ? (
        <Card>
          <Muted>Todavía no tenés portafolios. Creá el primero desde la web.</Muted>
        </Card>
      ) : null}
      {summary.error && !summary.data ? <ErrorText>{summary.error.message}</ErrorText> : null}

      {summary.data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <StatTile
              label="Valor total"
              value={money(summary.data.totalValue)}
              delta={<PercentText value={summary.data.changePercent24h} />}
            />
            <StatTile label="Invertido" value={money(summary.data.totalInvested)} />
          </View>
          {summary.data.capitalValue > 0 ? (
            <Card>
              <Row>
                <Muted>Capital (no cuenta en la ganancia)</Muted>
                <Body style={{ fontVariant: ['tabular-nums'] }}>{money(summary.data.capitalValue)}</Body>
              </Row>
            </Card>
          ) : null}
          <Card>
            <Row>
              <Muted>Ganancia no realizada</Muted>
              <PnlText value={summary.data.unrealizedPnl} format={money} />
            </Row>
            <Row>
              <Muted>Ganancia realizada</Muted>
              <PnlText value={summary.data.realizedPnl} format={money} />
            </Row>
            <Muted style={{ fontSize: 12 }}>
              Actualizado {new Date(summary.data.asOf).toLocaleString('es-EC')}
            </Muted>
          </Card>
        </>
      ) : null}

      {allocation.data && allocation.data.length > 0 ? (
        <Card>
          <Body style={{ fontWeight: '600' }}>Distribución</Body>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flexDirection: 'row', height: 10, borderRadius: radius.sm, overflow: 'hidden', gap: 2 }}
          >
            {allocation.data.map((a, i) => (
              <View
                key={a.assetSymbol}
                style={{
                  flex: Math.max(a.percentage, 0.5),
                  backgroundColor: i < SERIES.length ? SERIES[i] : t.textMuted,
                }}
              />
            ))}
          </View>
          {allocation.data.map((a, i) => (
            <Row key={a.assetSymbol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: i < SERIES.length ? SERIES[i] : t.textMuted,
                  }}
                />
                <Body>{a.assetSymbol}</Body>
              </View>
              <Muted>
                {money(a.valueInBaseCurrency)} · {a.percentage.toFixed(1)}%
              </Muted>
            </Row>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
