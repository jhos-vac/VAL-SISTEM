import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { PublicPortfolio } from '@val-sistem/shared';
import { Body, Card, ErrorText, Loading, Muted, PercentText, Row, Screen } from '@/components/ui';
import { SERIES } from '@/components/plan';
import { fetchPublicRanking } from '@/lib/plan-clients';
import { spacing, useTheme } from '@/lib/theme';

// Ranking de portafolios públicos: solo porcentajes, nunca montos.
export default function ExploreScreen() {
  const ranking = useQuery({ queryKey: ['public-ranking'], queryFn: fetchPublicRanking });

  return (
    <Screen onRefresh={() => void ranking.refetch()} refreshing={ranking.isRefetching}>
      <Muted>Los portafolios con mejor rendimiento sobre lo invertido. Tocá uno para ver su composición y copiarla.</Muted>
      {ranking.isLoading ? <Loading /> : null}
      {ranking.error && !ranking.data ? <ErrorText>{ranking.error.message}</ErrorText> : null}
      {ranking.data?.length === 0 ? (
        <Card>
          <Muted>Todavía no hay portafolios públicos. Publica uno tuyo desde Ajustes → Portafolios.</Muted>
        </Card>
      ) : null}
      {ranking.data?.map((p, i) => (
        <RankingCard key={p.id} portfolio={p} position={i + 1} />
      ))}
    </Screen>
  );
}

function RankingCard({ portfolio: p, position }: { portfolio: PublicPortfolio; position: number }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ${p.alias}`}
      onPress={() => router.push({ pathname: '/explore-detail', params: { id: p.id } })}
    >
      <Card>
        <Row>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
            <Muted style={{ fontVariant: ['tabular-nums'] }}>#{position}</Muted>
            <Body style={{ fontWeight: '700', color: t.primary }}>{p.alias}</Body>
          </View>
          <PercentText value={p.returnPercent} style={{ fontWeight: '700' }} />
        </Row>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: t.surfaceRaised }}>
          {p.composition.map((c, i) => (
            <View key={c.assetId} style={{ width: `${c.percent}%`, backgroundColor: SERIES[i % SERIES.length] }} />
          ))}
        </View>
        <Row>
          <Muted style={{ fontSize: 12 }}>
            {p.assetsCount} activo(s) · {p.copies} copia(s)
          </Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Muted style={{ fontSize: 12 }}>24 h</Muted>
            <PercentText value={p.changePercent24h} style={{ fontSize: 12 }} />
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}
