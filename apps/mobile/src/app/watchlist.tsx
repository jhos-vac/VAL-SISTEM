import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, type WatchlistItem } from '@val-sistem/shared';
import { Body, Button, Card, ErrorText, Loading, Muted, PercentText, Screen } from '@/components/ui';
import { AssetSelector } from '@/components/plan';
import { addToWatchlist, fetchWatchlist, removeFromWatchlist } from '@/lib/alerts-clients';
import { onColor, radius, SERIES, spacing, useTheme } from '@/lib/theme';

// Lista de seguimiento: monedas que sigues aunque no las tengas.
export default function WatchlistScreen() {
  const t = useTheme();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['watchlist'], queryFn: fetchWatchlist });
  const setData = (items: WatchlistItem[]) => queryClient.setQueryData(['watchlist'], items);
  const add = useMutation({ mutationFn: addToWatchlist, onSuccess: setData });
  const remove = useMutation({ mutationFn: removeFromWatchlist, onSuccess: setData });
  const [adding, setAdding] = useState(false);

  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching}>
      {adding ? (
        <Card>
          <AssetSelector
            held={[]}
            exclude={(list.data ?? []).map((i) => i.assetSymbol)}
            onPick={(s) => {
              add.mutate(s);
              setAdding(false);
            }}
          />
          <Button title="Cerrar" variant="secondary" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button title="Seguir una moneda" icon="star-outline" onPress={() => setAdding(true)} />
      )}
      {add.isError ? <ErrorText>{add.error.message}</ErrorText> : null}
      {list.isLoading ? <Loading /> : null}
      {list.data?.length === 0 ? (
        <Card>
          <Muted>Todavía no sigues ninguna moneda.</Muted>
        </Card>
      ) : null}
      {list.data?.map((i, idx) => {
        const color = SERIES[idx % SERIES.length]!;
        return (
          <Card key={i.assetSymbol}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: onColor(color), fontWeight: '700' }}>{i.assetSymbol.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700' }}>{i.assetSymbol}</Body>
                <Muted style={{ fontSize: 12 }}>{i.assetName}</Muted>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {i.price !== null ? formatCurrency(i.price, 'USD') : '—'}
                </Body>
                {i.changePercent24h !== null ? <PercentText value={i.changePercent24h} style={{ fontSize: 12 }} /> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/alerts', params: { asset: i.assetSymbol } })}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: t.surfaceRaised,
                }}
              >
                <Ionicons name="notifications-outline" size={16} color={t.foreground} />
                <Text style={{ color: t.foreground, fontWeight: '600' }}>Crear aviso</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dejar de seguir ${i.assetSymbol}`}
                onPress={() => remove.mutate(i.assetSymbol)}
                style={{ paddingHorizontal: spacing.lg, justifyContent: 'center' }}
              >
                <Text style={{ color: t.pnlDown, fontWeight: '600' }}>Quitar</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
