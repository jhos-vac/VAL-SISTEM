import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DCA_FREQUENCY_LABELS, formatCurrency, type DcaPlan } from '@val-sistem/shared';
import { Body, Button, Card, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { ProgressBar } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { deleteDcaPlan, fetchDcaPlans, updateDcaPlan } from '@/lib/plan-clients';
import { spacing, useTheme } from '@/lib/theme';

const DAY_MS = 86_400_000;

// Compras periódicas (DCA): estado de cada plan.
export default function DcaScreen() {
  const queryClient = useQueryClient();
  const { portfolio, isAggregate } = useActivePortfolio();
  const plans = useQuery({
    queryKey: ['dca-plans', portfolio?.id],
    queryFn: () => fetchDcaPlans(portfolio!.id),
    enabled: !!portfolio,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
  const toggle = useMutation({ mutationFn: (p: DcaPlan) => updateDcaPlan(p.id, { isActive: !p.isActive }), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteDcaPlan, onSuccess: invalidate });

  return (
    <Screen onRefresh={() => void plans.refetch()} refreshing={plans.isRefetching}>
      {!isAggregate ? <Button title="Nuevo plan" onPress={() => router.push('/dca-new')} /> : null}
      {plans.isLoading ? <Loading /> : null}
      {plans.error && !plans.data ? <ErrorText>{plans.error.message}</ErrorText> : null}
      {plans.data?.length === 0 ? (
        <Card>
          <Muted>Planificá compras fijas (por ejemplo 50 USD de BTC por semana) y seguí lo planeado contra lo comprado.</Muted>
        </Card>
      ) : null}
      {plans.data?.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          currency={portfolio?.baseCurrency ?? 'USD'}
          onToggle={() => toggle.mutate(p)}
          onDelete={() =>
            Alert.alert('Eliminar plan', `¿Eliminar el plan de ${p.assetSymbol}?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(p.id) },
            ])
          }
        />
      ))}
    </Screen>
  );
}

function PlanCard({
  plan,
  currency,
  onToggle,
  onDelete,
}: {
  plan: DcaPlan;
  currency: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const t = useTheme();
  const [now] = useState(() => Date.now());
  const money = (n: number) => formatCurrency(n, currency);
  const { plannedAmount, investedAmount, nextDate, periodsDue } = plan.progress;
  const ratio = plannedAmount > 0 ? investedAmount / plannedAmount : 0;
  const status = !plan.isActive
    ? { label: 'Pausado', color: t.textMuted }
    : ratio >= 1.05
      ? { label: 'Adelantado', color: t.pnlUp }
      : ratio >= 0.95
        ? { label: 'Al día', color: t.pnlUp }
        : { label: 'Atrasado', color: t.warning };
  const days = nextDate ? Math.max(0, Math.ceil((new Date(nextDate).getTime() - now) / DAY_MS)) : null;
  const max = Math.max(plannedAmount, investedAmount, 1);

  return (
    <Card>
      <Row>
        <Body style={{ fontWeight: '700' }}>
          {money(plan.amount)} de {plan.assetSymbol}
        </Body>
        <Muted style={{ color: status.color, fontWeight: '600' }}>{status.label}</Muted>
      </Row>
      <Muted style={{ fontSize: 13 }}>
        {DCA_FREQUENCY_LABELS[plan.frequency]} ·{' '}
        {nextDate ? (days === 0 ? 'toca comprar hoy' : `próxima compra en ${days} día(s)`) : 'plan terminado'}
      </Muted>
      <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
        <Row>
          <Muted style={{ fontSize: 12 }}>Planeado ({periodsDue} compras)</Muted>
          <Muted style={{ fontSize: 12 }}>{money(plannedAmount)}</Muted>
        </Row>
        <ProgressBar value={plannedAmount / max} color={t.textMuted} label="Planeado" />
        <Row>
          <Muted style={{ fontSize: 12 }}>Comprado en {plan.assetSymbol}</Muted>
          <Muted style={{ fontSize: 12 }}>{money(investedAmount)}</Muted>
        </Row>
        <ProgressBar value={investedAmount / max} color={t.primary} label="Comprado" />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title={plan.isActive ? 'Pausar' : 'Reanudar'} variant="secondary" onPress={onToggle} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Eliminar" variant="danger" onPress={onDelete} />
        </View>
      </View>
    </Card>
  );
}
