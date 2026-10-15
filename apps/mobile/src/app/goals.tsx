import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatPercent, GOAL_STATUS_LABELS, type Goal } from '@val-sistem/shared';
import { Body, Button, Card, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { ProgressBar } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { deleteGoal, fetchGoals } from '@/lib/plan-clients';
import { spacing, useTheme } from '@/lib/theme';

const DAY_MS = 86_400_000;

// Metas: progreso, avance contra tiempo y ritmo necesario.
export default function GoalsScreen() {
  const queryClient = useQueryClient();
  const { portfolio, isAggregate } = useActivePortfolio();
  const goals = useQuery({
    queryKey: ['goals', portfolio?.id],
    queryFn: () => fetchGoals(portfolio!.id),
    enabled: !!portfolio,
  });
  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
  const achieved = goals.data?.filter((g) => g.progress.status === 'achieved').length ?? 0;

  return (
    <Screen onRefresh={() => void goals.refetch()} refreshing={goals.isRefetching}>
      {goals.data && goals.data.length > 0 ? (
        <Muted>
          {achieved} de {goals.data.length} cumplida(s)
        </Muted>
      ) : null}
      {isAggregate ? (
        <Muted>Vista General: se ven las metas de todos tus portafolios. Para crear una, elegí un portafolio.</Muted>
      ) : (
        <Button title="Nueva meta" onPress={() => router.push('/goal-new')} />
      )}
      {goals.isLoading ? <Loading /> : null}
      {goals.error && !goals.data ? <ErrorText>{goals.error.message}</ErrorText> : null}
      {goals.data?.length === 0 ? (
        <Card>
          <Muted>Todavía no tenés metas. Por ejemplo: “llegar a 10.000 USD” o “+10 % en BTC”.</Muted>
        </Card>
      ) : null}
      {goals.data?.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          currency={portfolio?.baseCurrency ?? 'USD'}
          onDelete={() =>
            Alert.alert('Eliminar meta', `¿Eliminar “${g.name}”?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(g.id) },
            ])
          }
        />
      ))}
    </Screen>
  );
}

function GoalCard({ goal, currency, onDelete }: { goal: Goal; currency: string; onDelete: () => void }) {
  const t = useTheme();
  const [now] = useState(() => Date.now());
  const money = (n: number) => formatCurrency(n, currency);
  const p = goal.progress;
  const isValue = goal.kind === 'target_value';
  const color = p.status === 'achieved' ? t.pnlUp : p.status === 'expired' ? t.pnlDown : t.primary;
  const timeProgress = goal.deadline
    ? Math.min(
        1,
        Math.max(
          0,
          (now - new Date(goal.createdAt).getTime()) /
            Math.max(DAY_MS, new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime()),
        ),
      )
    : null;
  const onTrack = timeProgress === null || p.progress >= timeProgress;

  return (
    <Card>
      <Row>
        <Body style={{ fontWeight: '700', flex: 1 }}>{goal.name}</Body>
        <Muted style={{ color }}>{GOAL_STATUS_LABELS[p.status]}</Muted>
      </Row>
      <Muted style={{ fontSize: 13 }}>
        {goal.assetSymbol ? `${goal.assetSymbol} · ` : ''}
        {isValue ? `Llegar a ${money(goal.targetValue ?? 0)}` : `Ganar ${formatPercent(goal.targetPercent ?? 0)}`}
        {goal.deadline ? ` · hasta ${new Date(goal.deadline).toLocaleDateString('es-EC')}` : ''}
      </Muted>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Row>
          <Body style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>
            {isValue ? money(p.current) : formatPercent(p.current)}
          </Body>
          <Muted>{Math.round(p.progress * 100)}%</Muted>
        </Row>
        <ProgressBar value={p.progress} color={color} label={`Progreso de ${goal.name}`} />
        {timeProgress !== null && p.status === 'in_progress' ? (
          <>
            <Muted style={{ fontSize: 12 }}>Tiempo transcurrido {Math.round(timeProgress * 100)}%</Muted>
            <ProgressBar value={timeProgress} color={t.warning} label="Tiempo transcurrido" height={5} />
            <Muted style={{ fontSize: 12, color: onTrack ? t.pnlUp : t.warning }}>
              {onTrack ? 'Vas a tiempo.' : 'Vas por detrás del ritmo necesario.'}
            </Muted>
          </>
        ) : null}
      </View>
      {p.status === 'in_progress' ? (
        <View style={{ gap: 2, marginTop: spacing.xs }}>
          <Muted style={{ fontSize: 13 }}>Falta {money(p.remainingValue)}</Muted>
          {p.neededPerMonth !== null ? (
            <Muted style={{ fontSize: 13 }}>
              Hace falta crecer {money(p.neededPerMonth)} por mes ({p.daysLeft} día(s))
            </Muted>
          ) : null}
        </View>
      ) : null}
      <Button title="Eliminar" variant="secondary" onPress={onDelete} />
    </Card>
  );
}
