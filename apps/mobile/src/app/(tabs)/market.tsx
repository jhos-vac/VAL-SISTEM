import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@val-sistem/shared';
import { Body, Card, ErrorText, Loading, Muted, PercentText, Row, Screen, TextField } from '@/components/ui';
import { fetchTickers } from '@/lib/clients';

export default function MarketScreen() {
  const [search, setSearch] = useState('');
  const tickers = useQuery({ queryKey: ['tickers'], queryFn: fetchTickers, refetchInterval: 60_000 });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tickers.data ?? [];
    return q
      ? list.filter((t) => t.assetSymbol.toLowerCase().includes(q) || t.assetName.toLowerCase().includes(q))
      : list;
  }, [tickers.data, search]);

  return (
    <Screen onRefresh={() => void tickers.refetch()} refreshing={tickers.isRefetching}>
      <TextField
        label="Buscar"
        placeholder="BTC, Ethereum…"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {tickers.isLoading ? <Loading /> : null}
      {tickers.error && !tickers.data ? <ErrorText>{tickers.error.message}</ErrorText> : null}
      {filtered.map((t) => (
        <Card key={t.assetSymbol}>
          <Row>
            <Body style={{ fontWeight: '600' }}>{t.assetSymbol}</Body>
            <Body style={{ fontVariant: ['tabular-nums'] }}>{formatCurrency(t.price)}</Body>
          </Row>
          <Row>
            <Muted>{t.assetName}</Muted>
            <PercentText value={t.changePercent24h} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
