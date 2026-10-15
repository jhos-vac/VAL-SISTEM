import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Body, Button, Card, ErrorText, Loading, Muted, PercentText, Row, Screen, TextField } from '@/components/ui';
import { ProgressBar, SectionTitle, SERIES } from '@/components/plan';
import { copyPublicPortfolio, fetchPublicPortfolio } from '@/lib/plan-clients';
import { usePortfolioSelection } from '@/store/portfolio';
import { spacing, useTheme } from '@/lib/theme';

// Detalle de un portafolio público y copia como estrategia propia.
export default function ExploreDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const setActive = usePortfolioSelection((s) => s.setActivePortfolioId);
  const [name, setName] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ['public-portfolio', id],
    queryFn: () => fetchPublicPortfolio(id),
    enabled: !!id,
  });
  const portfolio = detail.data;
  const copyName = name ?? (portfolio ? `Copia de ${portfolio.alias}` : '');

  const copy = useMutation({
    mutationFn: () => copyPublicPortfolio(id, copyName.trim()),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] });
      await queryClient.invalidateQueries({ queryKey: ['public-ranking'] });
      setActive(created.id);
      router.replace('/strategy');
    },
  });

  if (detail.isLoading) return <Screen><Loading /></Screen>;
  if (!portfolio) {
    return (
      <Screen>
        <ErrorText>{detail.error?.message ?? 'No se encontró el portafolio.'}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Card>
        <Row>
          <Body style={{ fontWeight: '700', fontSize: 18 }}>{portfolio.alias}</Body>
          <PercentText value={portfolio.returnPercent} style={{ fontWeight: '700', fontSize: 18 }} />
        </Row>
        <Muted style={{ fontSize: 13 }}>
          Publicado el {new Date(portfolio.publishedAt).toLocaleDateString('es-EC')} · {portfolio.assetsCount} activo(s) ·{' '}
          {portfolio.copies} copia(s)
        </Muted>
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: t.surfaceRaised }}>
          {portfolio.composition.map((c, i) => (
            <View key={c.assetId} style={{ width: `${c.percent}%`, backgroundColor: SERIES[i % SERIES.length] }} />
          ))}
        </View>
      </Card>

      <SectionTitle>Composición</SectionTitle>
      {portfolio.composition.map((c, i) => (
        <Card key={c.assetId}>
          <Row>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SERIES[i % SERIES.length] }} />
              <Body style={{ fontWeight: '600' }}>{c.assetSymbol}</Body>
              <Muted style={{ fontSize: 12 }}>{c.assetName}</Muted>
            </View>
            <Body style={{ fontVariant: ['tabular-nums'] }}>{c.percent.toFixed(1)}%</Body>
          </Row>
          <ProgressBar value={c.percent / 100} color={SERIES[i % SERIES.length]} label={`Peso de ${c.assetSymbol}`} />
          <Row>
            <Muted style={{ fontSize: 12 }}>Rendimiento</Muted>
            {c.returnPercent === null ? <Muted style={{ fontSize: 12 }}>—</Muted> : <PercentText value={c.returnPercent} style={{ fontSize: 12 }} />}
          </Row>
        </Card>
      ))}

      <Card>
        <SectionTitle>Copiar como estrategia</SectionTitle>
        <Muted style={{ fontSize: 13 }}>
          Se crea un portafolio tuyo, vacío, con esta composición como asignación objetivo. Después ves qué comprar para
          llegar.
        </Muted>
        <TextField label="Nombre del nuevo portafolio" value={copyName} onChangeText={setName} />
        {copy.isError ? <ErrorText>{copy.error.message}</ErrorText> : null}
        <Button
          title="Copiar portafolio"
          onPress={() => copy.mutate()}
          disabled={copyName.trim().length === 0}
          loading={copy.isPending}
        />
      </Card>
    </Screen>
  );
}
