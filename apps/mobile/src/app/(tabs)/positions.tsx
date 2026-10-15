import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { AssetPosition, SortDir, SortKey } from '@val-sistem/shared';
import { formatCurrency, formatQuantity, pnlPercent, SORT_OPTIONS, sortPositions } from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { Body, Card, Chip, ErrorText, Loading, Muted, PercentText, PnlText, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions, fetchWallets, type Wallet } from '@/lib/clients';
import { spacing } from '@/lib/theme';

// Posiciones agrupadas por wallet (Spot, Earn, Fondos, manual), igual que
// la web. Se pueden ordenar y cada una abre su rendimiento por compra.
export default function PositionsScreen() {
  const { portfolio, isAggregate } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'value', dir: 'desc' });

  const positions = useQuery({
    queryKey: ['positions', portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });
  const wallets = useQuery({
    queryKey: ['wallets', portfolio?.id],
    queryFn: () => fetchWallets(portfolio!.id),
    enabled: !!portfolio && !isAggregate,
  });

  const groups = useMemo(() => {
    const names = new Map<string, string>((wallets.data ?? []).map((w: Wallet) => [w.id, w.walletName]));
    const byWallet = new Map<string, AssetPosition[]>();
    for (const p of positions.data ?? []) {
      byWallet.set(p.walletId, [...(byWallet.get(p.walletId) ?? []), p]);
    }
    return [...byWallet.entries()].map(([walletId, items]) => ({
      walletId,
      name: names.get(walletId) ?? 'Wallet',
      items: sortPositions(items, sort.key, sort.dir),
    }));
  }, [positions.data, wallets.data, sort]);

  const pickSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: SORT_OPTIONS.find((o) => o.value === key)!.defaultDir },
    );

  return (
    <Screen onRefresh={() => void positions.refetch()} refreshing={positions.isRefetching}>
      <PortfolioHeader />
      {positions.data && positions.data.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={sort.key === o.value ? `${o.label} ${sort.dir === 'asc' ? '↑' : '↓'}` : o.label}
              selected={sort.key === o.value}
              onPress={() => pickSort(o.value)}
            />
          ))}
        </ScrollView>
      ) : null}
      {positions.isLoading ? <Loading /> : null}
      {positions.error && !positions.data ? <ErrorText>{positions.error.message}</ErrorText> : null}
      {positions.data?.length === 0 ? (
        <Card>
          <Muted>Sin posiciones. Registrá una compra o conectá Binance.</Muted>
        </Card>
      ) : null}
      {groups.map((g) => (
        <View key={g.walletId} style={{ gap: spacing.sm }}>
          {groups.length > 1 || !isAggregate ? <Muted>{g.name}</Muted> : null}
          {g.items.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver compras de ${p.assetSymbol}`}
              onPress={() => router.push({ pathname: '/lots', params: { asset: p.assetSymbol } })}
            >
              <Card>
                <Row>
                  <Body style={{ fontWeight: '600' }}>{p.assetSymbol}</Body>
                  <Body style={{ fontVariant: ['tabular-nums'] }}>{money(p.currentValue)}</Body>
                </Row>
                <Row>
                  <Muted>
                    {formatQuantity(p.quantity)} · costo {money(p.averageCost)}
                  </Muted>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <PnlText value={p.unrealizedPnl} format={money} />
                    <PercentText value={pnlPercent(p)} />
                  </View>
                </Row>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}
