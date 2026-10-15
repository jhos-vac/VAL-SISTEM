import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { TRANSACTION_TYPE_LABELS, type TransactionType } from '@val-sistem/shared';
import { formatCurrency, formatQuantity } from '@val-sistem/shared';
import { PortfolioHeader } from '@/components/PortfolioHeader';
import { Body, Button, Card, Chip, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchTransactions } from '@/lib/clients';
import { spacing } from '@/lib/theme';

export default function TransactionsScreen() {
  const { portfolio, isAggregate } = useActivePortfolio();
  const [type, setType] = useState<TransactionType | undefined>();
  const [includeCapital, setIncludeCapital] = useState(false);
  const currency = portfolio?.baseCurrency ?? 'USD';

  const transactions = useQuery({
    queryKey: ['transactions', portfolio?.id, type, includeCapital],
    queryFn: () => fetchTransactions({ portfolioId: portfolio!.id, type, includeCapital }),
    enabled: !!portfolio,
  });

  return (
    <Screen onRefresh={() => void transactions.refetch()} refreshing={transactions.isRefetching}>
      <PortfolioHeader />
      {!isAggregate && portfolio ? (
        <Button title="Registrar compra o venta" onPress={() => router.push('/transaction-new')} />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label="Todas" selected={!type} onPress={() => setType(undefined)} />
        {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((key) => (
          <Chip key={key} label={TRANSACTION_TYPE_LABELS[key]} selected={type === key} onPress={() => setType(key)} />
        ))}
      </ScrollView>
      <Row>
        <Muted>Mostrar capital (USDT…)</Muted>
        <View>
          <Switch value={includeCapital} onValueChange={setIncludeCapital} accessibilityLabel="Mostrar capital" />
        </View>
      </Row>
      {transactions.isLoading ? <Loading /> : null}
      {transactions.error && !transactions.data ? <ErrorText>{transactions.error.message}</ErrorText> : null}
      {transactions.data?.length === 0 ? (
        <Card>
          <Muted>No hay movimientos con este filtro.</Muted>
        </Card>
      ) : null}
      {transactions.data?.map((tx) => (
        <Card key={tx.id}>
          <Row>
            <Body style={{ fontWeight: '600' }}>
              {TRANSACTION_TYPE_LABELS[tx.type]} · {tx.assetSymbol}
            </Body>
            <Body style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(tx.quantity * tx.price, currency)}</Body>
          </Row>
          <Row>
            <Muted>
              {formatQuantity(tx.quantity)} a {formatCurrency(tx.price, currency)}
            </Muted>
            <Muted>{new Date(tx.executedAt).toLocaleDateString('es-EC')}</Muted>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
