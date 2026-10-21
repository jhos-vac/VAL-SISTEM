import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { GOAL_MILESTONES, suggestedPlan, type Goal } from '@val-sistem/shared';
import { Button, Muted } from '@/components/ui';
import { radius, spacing, useTheme } from '@/lib/theme';

// Barras de lo que mide la meta en los últimos 90 días (una por día, como
// mucho 30), con una línea en el objetivo.
export function GoalChart({ goal, color, format }: { goal: Goal; color: string; format: (n: number) => string }) {
  const t = useTheme();
  const all = goal.history;
  if (all.length < 2) return null;
  const step = Math.max(1, Math.ceil(all.length / 30));
  const points = all.filter((_, i) => (all.length - 1 - i) % step === 0);
  const target = goal.progress.target;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, target);
  const min = Math.min(...values, target, 0);
  const span = max - min || 1;
  const pct = (v: number) => ((v - min) / span) * 100;
  const HEIGHT = 64;

  return (
    <View
      accessible
      accessibilityLabel={`Evolución: de ${format(points[0]!.value)} a ${format(points[points.length - 1]!.value)}. Objetivo ${format(target)}.`}
      style={{ gap: 4 }}
    >
      <View style={{ height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        {points.map((p, i) => (
          <View
            key={p.date}
            style={{
              flex: 1,
              height: `${Math.max(3, pct(p.value))}%`,
              borderRadius: 3,
              backgroundColor: color,
              opacity: i === points.length - 1 ? 1 : 0.45,
            }}
          />
        ))}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: `${pct(target)}%`,
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: t.textMuted,
          }}
        />
      </View>
      <Muted style={{ fontSize: 11 }}>
        Desde el {new Date(points[0]!.date).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} · línea punteada: objetivo
      </Muted>
    </View>
  );
}

// Hitos de 25, 50 y 75 %.
export function GoalMilestones({ goal }: { goal: Goal }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityLabel="Hitos de la meta">
      {GOAL_MILESTONES.map((m) => {
        const reached = goal.progress.progress >= m;
        return (
          <View
            key={m}
            style={{
              borderRadius: radius.pill,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
              backgroundColor: reached ? t.primarySoft : t.surfaceRaised,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: reached ? t.pnlUp : t.textMuted }}>
              {reached ? '✓ ' : ''}
              {Math.round(m * 100)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Plan semanal sugerido para llegar a la fecha; abre el formulario de plan
// precargado.
export function GoalPlanSuggestion({ goal, money }: { goal: Goal; money: (n: number) => string }) {
  const plan = suggestedPlan(goal);
  if (!plan) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <Muted style={{ fontSize: 13 }}>
        Para llegar a tiempo: {money(plan.amountPerWeek)} por semana durante {plan.purchases} semana(s), sin contar lo
        que suba o baje el mercado.
      </Muted>
      <Button
        title="Crear este plan de compras"
        variant="secondary"
        icon="repeat-outline"
        onPress={() =>
          router.push({
            pathname: '/dca-new',
            params: {
              amount: String(plan.amountPerWeek),
              endDate: plan.endDate,
              ...(goal.assetSymbol ? { asset: goal.assetSymbol } : {}),
            },
          })
        }
      />
    </View>
  );
}
