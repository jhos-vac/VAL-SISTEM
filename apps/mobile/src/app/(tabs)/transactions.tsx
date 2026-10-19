import { useState, type ComponentProps } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { TRANSACTION_TYPE_LABELS, type TransactionType } from '@val-sistem/shared';
import { formatCurrency, formatQuantity } from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { Body, Button, Card, Chip, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions, fetchTransactions } from '@/lib/clients';
import { radius, spacing, useTheme } from '@/lib/theme';

const DAY_MS = 86_400_000;
const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 0, label: 'Todo' },
];

const TYPE_ICON: Record<TransactionType, ComponentProps<typeof Ionicons>['name']> = {
  buy: 'arrow-down',
  sell: 'arrow-up',
  transfer_in: 'enter-outline',
  transfer_out: 'exit-outline',
};

export default function TransactionsScreen() {
  const t = useTheme();
  const { portfolio, isAggregate } = useActivePortfolio();
  const [type, setType] = useState<TransactionType | undefined>();
  const [asset, setAsset] = useState<string | undefined>();
  const [days, setDays] = useState(0);
  const [includeCapital, setIncludeCapital] = useState(false);
  const [now] = useState(() => Date.now());
  const currency = portfolio?.baseCurrency ?? 'USD';
  const from = days > 0 ? new Date(now - days * DAY_MS).toISOString() : undefined;

  const positions = useQuery({
    queryKey: ['positions', portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });
  const transactions = useQuery({
    queryKey: ['transactions', portfolio?.id, type, asset, days, includeCapital],
    queryFn: () =>
      fetchTransactions({ portfolioId: portfolio!.id, type, assetSymbol: asset, from, includeCapital }),
    enabled: !!portfolio,
  });
  const assets = [...new Set((positions.data ?? []).map((p) => p.assetSymbol))].sort();

  return (
    <Screen onRefresh={() => void transactions.refetch()} refreshing={transactions.isRefetching}>
      <PortfolioHeader />
      {!isAggregate && portfolio ? (
        <Button title="Registrar compra o venta" icon="add" onPress={() => router.push('/transaction-new')} />
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Todas" selected={!type} onPress={() => setType(undefined)} />
        {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((key) => (
          <Chip key={key} label={TRANSACTION_TYPE_LABELS[key]} selected={type === key} onPress={() => setType(key)} />
        ))}
      </ScrollView>
      {assets.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="Todos los activos" selected={!asset} onPress={() => setAsset(undefined)} />
          {assets.map((s) => (
            <Chip key={s} label={s} selected={asset === s} onPress={() => setAsset(s)} />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {PERIODS.map((p) => (
          <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => setDays(p.days)} />
        ))}
      </ScrollView>
      <Row>
        <Muted>Mostrar capital (USDT…)</Muted>
        <Switch
          value={includeCapital}
          onValueChange={setIncludeCapital}
          accessibilityLabel="Mostrar capital"
          trackColor={{ true: t.primary, false: t.surfaceRaised }}
        />
      </Row>

      {transactions.isLoading ? <Loading /> : null}
      {transactions.error && !transactions.data ? <ErrorText>{transactions.error.message}</ErrorText> : null}
      {transactions.data?.length === 0 ? (
        <Card>
          <Muted>No hay movimientos con estos filtros.</Muted>
        </Card>
      ) : null}
      {transactions.data && transactions.data.length > 0 ? (
        <Card style={{ gap: spacing.xs }}>
          {transactions.data.map((tx, i) => {
            const incoming = tx.type === 'buy' || tx.type === 'transfer_in';
            return (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    backgroundColor: t.surfaceRaised,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={TYPE_ICON[tx.type]} size={18} color={t.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>
                    {TRANSACTION_TYPE_LABELS[tx.type]} · {tx.assetSymbol}
                  </Body>
                  <Muted style={{ fontSize: 12 }}>
                    {formatQuantity(tx.quantity)} a {formatCurrency(tx.price, currency)} ·{' '}
                    {new Date(tx.executedAt).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </Muted>
                </View>
                <Text
                  style={{
                    color: incoming ? t.foreground : t.textSecondary,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {incoming ? '+' : '−'}
                  {formatCurrency(tx.quantity * tx.price, currency)}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
