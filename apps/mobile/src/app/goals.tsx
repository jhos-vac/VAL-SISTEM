import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatCurrency,
  formatGoalMetric,
  formatPercent,
  formatQuantity,
  GOAL_STATUS_LABELS,
  goalTargetText,
  projectionText,
  type Goal,
} from '@val-sistem/shared';
import { Body, Button, Card, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { ProgressBar } from '@/components/plan';
import { GoalChart, GoalMilestones, GoalPlanSuggestion } from '@/components/GoalExtras';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { deleteGoal, fetchGoals } from '@/lib/plan-clients';
import { radius, spacing, useTheme } from '@/lib/theme';

const DAY_MS = 86_400_000;

// Metas: progreso, avance contra tiempo, ritmo necesario y proyección.
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
  const [showAchieved, setShowAchieved] = useState(false);
  const achievedGoals = goals.data?.filter((g) => g.progress.status === 'achieved') ?? [];
  const activeGoals = goals.data?.filter((g) => g.progress.status !== 'achieved') ?? [];
  const achieved = achievedGoals.length;
  const renderGoal = (g: Goal) => (
    <GoalCard
      key={g.id}
      goal={g}
      currency={portfolio?.baseCurrency ?? 'USD'}
      canPlan={!isAggregate}
      onEdit={() => router.push({ pathname: '/goal-new', params: { id: g.id } })}
      onDelete={() =>
        Alert.alert('Eliminar meta', `¿Eliminar “${g.name}”?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(g.id) },
        ])
      }
    />
  );

  return (
    <Screen onRefresh={() => void goals.refetch()} refreshing={goals.isRefetching}>
      {goals.data && goals.data.length > 0 ? (
        <Muted>
          {achieved} de {goals.data.length} cumplida(s)
        </Muted>
      ) : null}
      {isAggregate ? (
        <Muted>Vista General: se ven las metas de todos tus portafolios. Para crear una, elige un portafolio.</Muted>
      ) : (
        <Button title="Nueva meta" icon="add" onPress={() => router.push('/goal-new')} />
      )}
      {goals.isLoading ? <Loading /> : null}
      {goals.error && !goals.data ? <ErrorText>{goals.error.message}</ErrorText> : null}
      {goals.data?.length === 0 ? (
        <Card>
          <Muted>Todavía no tienes metas. Por ejemplo: “llegar a 10.000 USD”, “tener 0,5 BTC” o “ETH a 4.000”.</Muted>
        </Card>
      ) : null}
      {activeGoals.map(renderGoal)}
      {achievedGoals.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showAchieved }}
          onPress={() => setShowAchieved(!showAchieved)}
          hitSlop={8}
        >
          <Muted style={{ fontWeight: '600' }}>
            {showAchieved ? '▾' : '▸'} Cumplidas ({achievedGoals.length})
          </Muted>
        </Pressable>
      ) : null}
      {showAchieved ? achievedGoals.map(renderGoal) : null}
    </Screen>
  );
}

function GoalCard({
  goal,
  currency,
  canPlan,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  canPlan: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [now] = useState(() => Date.now());
  const money = (n: number) => formatCurrency(n, currency);
  const metric = (n: number) => formatGoalMetric(goal.kind, n, money, goal.assetSymbol);
  const p = goal.progress;
  const color = p.status === 'achieved' ? t.pnlUp : p.status === 'expired' ? t.pnlDown : t.primary;
  const projection = projectionText(goal, money);
  const timeProgress =
    goal.deadline && goal.kind !== 'target_price'
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
        <Body style={{ fontWeight: '700', flex: 1 }}>{goal.name || goalTargetText(goal, money)}</Body>
        <Muted style={{ color, fontWeight: '600' }}>{GOAL_STATUS_LABELS[p.status]}</Muted>
      </Row>
      <Muted style={{ fontSize: 13 }}>
        {goalTargetText(goal, money)}
        {goal.deadline ? ` · hasta ${new Date(goal.deadline).toLocaleDateString('es-EC')}` : ''}
      </Muted>
      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <Row>
          <Body style={{ fontVariant: ['tabular-nums'], fontWeight: '600' }}>
            {metric(p.current)} <Muted style={{ fontSize: 13 }}>de {metric(p.target)}</Muted>
          </Body>
          <Muted>{Math.round(p.progress * 100)}%</Muted>
        </Row>
        <ProgressBar value={p.progress} color={color} label={`Progreso de ${goal.name}`} />
        {p.status === 'achieved' ? (
          <Muted style={{ fontSize: 13, fontWeight: '700', color: t.pnlUp }}>¡Meta cumplida!</Muted>
        ) : (
          <>
            <GoalChart goal={goal} color={color} format={metric} />
            {goal.kind !== 'target_price' ? <GoalMilestones goal={goal} /> : null}
          </>
        )}
        {goal.kind === 'target_price' && goal.completedAt ? (
          <Muted style={{ fontSize: 12, color: t.pnlUp }}>
            Tocó el precio el {new Date(goal.completedAt).toLocaleDateString('es-EC')}.
          </Muted>
        ) : null}
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
          {goal.kind === 'target_price' ? (
            <Muted style={{ fontSize: 13 }}>
              {goal.priceDirection === 'below' ? 'Tiene que bajar' : 'Tiene que subir'}{' '}
              {formatPercent(Math.abs(p.current > 0 ? ((p.target - p.current) / p.current) * 100 : 0)).replace(/^\+/, '')}
            </Muted>
          ) : goal.kind === 'asset_quantity' ? (
            <Muted style={{ fontSize: 13 }}>
              Faltan {formatQuantity(Math.max(0, p.target - p.current))} {goal.assetSymbol} (≈ {money(p.remainingValue)})
            </Muted>
          ) : (
            <Muted style={{ fontSize: 13 }}>Falta {money(p.remainingValue)}</Muted>
          )}
          {p.neededPerMonth !== null ? (
            <Muted style={{ fontSize: 13 }}>
              Hace falta crecer {money(p.neededPerMonth)} por mes ({p.daysLeft} día(s))
            </Muted>
          ) : null}
        </View>
      ) : null}
      {projection ? (
        <View
          style={{
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: t.surfaceRaised,
          }}
        >
          <Muted
            style={{
              fontSize: 12,
              color: projection.tone === 'good' ? t.pnlUp : projection.tone === 'warning' ? t.warning : t.textSecondary,
            }}
          >
            {projection.text}
          </Muted>
        </View>
      ) : null}
      {canPlan ? <GoalPlanSuggestion goal={goal} money={money} /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Editar" variant="secondary" icon="create-outline" onPress={onEdit} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Eliminar" variant="danger" onPress={onDelete} />
        </View>
      </View>
    </Card>
  );
}
