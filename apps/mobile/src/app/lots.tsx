import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency, formatPercent, formatQuantity, type AssetLots } from '@val-sistem/shared';
import { Body, Card, Chip, ErrorText, Loading, Muted, PnlText, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchLots } from '@/lib/plan-clients';
import { spacing, useTheme } from '@/lib/theme';

// Rendimiento por compra: cada compra con su precio y su ganancia. Las
// ventas descuentan primero las compras más antiguas (FIFO).
export default function LotsScreen() {
  const t = useTheme();
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  const { portfolio } = useActivePortfolio();
  const [showClosed, setShowClosed] = useState(false);
  const currency = portfolio?.baseCurrency ?? 'USD';

  const lots = useQuery({
    queryKey: ['lots', portfolio?.id],
    queryFn: () => fetchLots(portfolio!.id),
    enabled: !!portfolio,
  });
  const all = lots.data ?? [];
  const groups = all.filter((g) => (!asset || g.assetSymbol === asset) && (showClosed || g.quantity > 0));

  return (
    <Screen onRefresh={() => void lots.refetch()} refreshing={lots.isRefetching}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Todos" selected={!asset} onPress={() => router.setParams({ asset: '' })} />
        {all.map((g) => (
          <Chip
            key={g.assetSymbol}
            label={g.assetSymbol}
            selected={asset === g.assetSymbol}
            onPress={() => router.setParams({ asset: g.assetSymbol })}
          />
        ))}
      </ScrollView>
      <Row>
        <Muted>Mostrar compras ya vendidas</Muted>
        <Switch
          accessibilityLabel="Mostrar compras ya vendidas"
          value={showClosed}
          onValueChange={setShowClosed}
          trackColor={{ true: t.primary, false: t.surfaceRaised }}
        />
      </Row>
      {lots.isLoading ? <Loading /> : null}
      {lots.error && !lots.data ? <ErrorText>{lots.error.message}</ErrorText> : null}
      {lots.data && groups.length === 0 ? (
        <Card>
          <Muted>No hay compras para mostrar.</Muted>
        </Card>
      ) : null}
      {groups.map((g) => (
        <AssetLotsCard key={g.assetSymbol} group={g} currency={currency} showClosed={showClosed} />
      ))}
    </Screen>
  );
}

function AssetLotsCard({ group, currency, showClosed }: { group: AssetLots; currency: string; showClosed: boolean }) {
  const t = useTheme();
  const money = (n: number) => formatCurrency(n, currency);
  const pct = group.invested > 0 ? (group.unrealizedPnl / group.invested) * 100 : 0;
  const lots = group.lots.filter((l) => showClosed || l.isOpen);

  return (
    <Card>
      <Row>
        <Body style={{ fontWeight: '700', fontSize: 17 }}>{group.assetSymbol}</Body>
        <Muted>{money(group.currentPrice)}</Muted>
      </Row>
      <Row>
        <Muted>
          {formatQuantity(group.quantity)} · invertido {money(group.invested)}
        </Muted>
        <View style={{ alignItems: 'flex-end' }}>
          <PnlText value={group.unrealizedPnl} format={money} />
          <Muted style={{ fontSize: 12 }}>{formatPercent(pct)}</Muted>
        </View>
      </Row>
      <View style={{ height: 1, backgroundColor: t.border, marginVertical: spacing.xs }} />
      {lots.map((lot) => (
        <View
          key={lot.id}
          style={{ gap: 2, paddingVertical: spacing.sm, opacity: lot.isOpen ? 1 : 0.55 }}
        >
          <Row>
            <Body>
              {new Date(lot.openedAt).toLocaleDateString('es-EC')}
              {lot.source === 'transfer_in' ? ' · entrada' : ''}
            </Body>
            {lot.isOpen ? (
              <PnlText value={lot.unrealizedPnl} format={money} />
            ) : (
              <Muted>Vendida</Muted>
            )}
          </Row>
          <Row>
            <Muted style={{ fontSize: 13 }}>
              {formatQuantity(lot.isOpen ? lot.remaining : lot.quantity)} a {money(lot.price)} · {lot.walletName}
            </Muted>
            {lot.isOpen ? (
              <Muted style={{ fontSize: 12 }}>{formatPercent(lot.unrealizedPercent)}</Muted>
            ) : lot.realizedPnl !== 0 ? (
              <PnlText value={lot.realizedPnl} format={money} style={{ fontSize: 12 }} />
            ) : null}
          </Row>
        </View>
      ))}
      {group.untracked.map((u) => (
        <View key={`u-${u.walletId}`} style={{ paddingVertical: spacing.sm }}>
          <Row>
            <Muted>Sin compra registrada · {u.walletName}</Muted>
            <Muted>{formatQuantity(u.quantity)}</Muted>
          </Row>
          <Muted style={{ fontSize: 12 }}>Ganancia estimada al costo promedio ({money(u.averageCost)}).</Muted>
        </View>
      ))}
    </Card>
  );
}
