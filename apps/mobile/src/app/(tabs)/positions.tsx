import { useMemo } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { AssetPosition } from '@val-sistem/shared';
import { formatCurrency, formatQuantity } from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { Body, Card, ErrorText, Loading, Muted, PnlText, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions, fetchWallets, type Wallet } from '@/lib/clients';
import { spacing } from '@/lib/theme';

// Posiciones agrupadas por wallet (Spot, Earn, Fondos, manual), igual que
// la web.
export default function PositionsScreen() {
  const { portfolio, isAggregate } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);

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
      items: items.sort((a, b) => b.currentValue - a.currentValue),
    }));
  }, [positions.data, wallets.data]);

  return (
    <Screen onRefresh={() => void positions.refetch()} refreshing={positions.isRefetching}>
      <PortfolioHeader />
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
            <Card key={p.id}>
              <Row>
                <Body style={{ fontWeight: '600' }}>{p.assetSymbol}</Body>
                <Body style={{ fontVariant: ['tabular-nums'] }}>{money(p.currentValue)}</Body>
              </Row>
              <Row>
                <Muted>
                  {formatQuantity(p.quantity)} · costo {money(p.averageCost)}
                </Muted>
                <PnlText value={p.unrealizedPnl} format={money} />
              </Row>
            </Card>
          ))}
        </View>
      ))}
    </Screen>
  );
}
