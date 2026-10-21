import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  defaultGoalName,
  formatCurrency,
  formatPercent,
  formatQuantity,
  GOAL_KIND_LABELS,
  isAssetGoalKind,
  type Goal,
  type GoalKind,
} from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Loading, Muted, Row, Screen, TextField } from '@/components/ui';
import { AssetSelector, ProgressBar, SectionTitle } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions, fetchSummary, fetchTickers } from '@/lib/clients';
import { createGoal, fetchGoals, updateGoal } from '@/lib/plan-clients';
import { spacing } from '@/lib/theme';

const DAY_MS = 86_400_000;
const KINDS: GoalKind[] = ['target_value', 'gain_percent', 'asset_quantity', 'target_price'];
const parseNumber = (s: string) => Number(s.trim().replace(',', '.'));

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function targetOf(goal: Goal): number | null {
  switch (goal.kind) {
    case 'target_value':
      return goal.targetValue;
    case 'gain_percent':
      return goal.targetPercent;
    case 'asset_quantity':
      return goal.targetQuantity;
    case 'target_price':
      return goal.targetPrice;
  }
}

function roundQty(n: number): number {
  if (n <= 0) return 0;
  const digits = Math.max(0, 3 - Math.floor(Math.log10(n)));
  return Number(n.toFixed(Math.min(8, digits)));
}

// Crear (sin id) o editar (con id) una meta, con vista previa en vivo.
export default function GoalFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { portfolio } = useActivePortfolio();
  const goals = useQuery({
    queryKey: ['goals', portfolio?.id],
    queryFn: () => fetchGoals(portfolio!.id),
    enabled: !!portfolio && !!id,
  });
  if (id) {
    const goal = goals.data?.find((g) => g.id === id);
    if (goals.isLoading) return <Screen><Loading /></Screen>;
    if (!goal) {
      return (
        <Screen>
          <Muted>No se encontró la meta.</Muted>
        </Screen>
      );
    }
    return <GoalForm key={goal.id} editing={goal} />;
  }
  return <GoalForm />;
}

function GoalForm({ editing }: { editing?: Goal }) {
  const queryClient = useQueryClient();
  const { portfolio } = useActivePortfolio();
  const portfolioId = editing?.portfolioId ?? portfolio?.id;
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const [now] = useState(() => Date.now());
  const [kind, setKind] = useState<GoalKind>(editing?.kind ?? 'target_value');
  const [name, setName] = useState(editing?.name ?? '');
  const [target, setTarget] = useState(editing ? String(targetOf(editing) ?? '') : '');
  const [deadline, setDeadline] = useState(editing?.deadline?.slice(0, 10) ?? '');
  const [assetSymbol, setAssetSymbol] = useState<string | null>(editing?.assetSymbol ?? null);
  const [pickingAsset, setPickingAsset] = useState(false);
  const needsAsset = isAssetGoalKind(kind);

  const summary = useQuery({
    queryKey: ['portfolio-summary', portfolioId],
    queryFn: () => fetchSummary(portfolioId!),
    enabled: !!portfolioId,
  });
  const positions = useQuery({
    queryKey: ['positions', portfolioId],
    queryFn: () => fetchPositions(portfolioId!),
    enabled: !!portfolioId,
  });
  const tickers = useQuery({ queryKey: ['tickers'], queryFn: fetchTickers, enabled: needsAsset });

  const base = useMemo(() => {
    if (assetSymbol) {
      const own = (positions.data ?? []).filter((p) => p.assetSymbol === assetSymbol);
      return {
        value: own.reduce((s, p) => s + p.currentValue, 0),
        invested: own.reduce((s, p) => s + p.quantity * p.averageCost, 0),
        gain: own.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0),
        quantity: own.reduce((s, p) => s + p.quantity, 0),
        price: tickers.data?.find((tk) => tk.assetSymbol === assetSymbol)?.price ?? own[0]?.currentPrice ?? 0,
      };
    }
    if (!summary.data) return null;
    return {
      value: summary.data.totalValue,
      invested: summary.data.totalInvested,
      gain: summary.data.unrealizedPnl + summary.data.realizedPnl,
      quantity: 0,
      price: 0,
    };
  }, [assetSymbol, positions.data, summary.data, tickers.data]);

  const targetNumber = parseNumber(target);
  const valid = targetNumber > 0 && (!needsAsset || !!assetSymbol);
  const currentPercent = base && base.invested > 0 ? (base.gain / base.invested) * 100 : 0;
  const monthsLeft = deadline
    ? Math.max((new Date(`${deadline}T23:59:59`).getTime() - now) / (30.44 * DAY_MS), 1 / 30)
    : null;

  const preview = (() => {
    if (!base) return null;
    if (kind === 'target_value' || kind === 'gain_percent') {
      const targetValue = kind === 'target_value' ? targetNumber : base.invested * (1 + targetNumber / 100);
      return {
        current: kind === 'target_value' ? money(base.value) : formatPercent(currentPercent),
        progress:
          targetNumber > 0 ? (kind === 'target_value' ? base.value / targetNumber : currentPercent / targetNumber) : 0,
        target: kind === 'target_value' ? money(targetNumber) : `${formatPercent(targetNumber)} (${money(targetValue)})`,
        remaining: Math.max(0, targetValue - base.value),
        remainingText: money(Math.max(0, targetValue - base.value)),
      };
    }
    if (kind === 'asset_quantity') {
      const missing = Math.max(0, targetNumber - base.quantity);
      return {
        current: `${formatQuantity(base.quantity)} ${assetSymbol ?? ''}`,
        progress: targetNumber > 0 ? base.quantity / targetNumber : 0,
        target: `${formatQuantity(targetNumber)} ${assetSymbol ?? ''}`,
        remaining: missing * base.price,
        remainingText: `${formatQuantity(missing)} ${assetSymbol ?? ''} (≈ ${money(missing * base.price)})`,
      };
    }
    return {
      current: money(base.price),
      progress:
        base.price > 0 && targetNumber > 0
          ? targetNumber >= base.price
            ? base.price / targetNumber
            : targetNumber / base.price
          : 0,
      target: `${money(targetNumber)} (${formatPercent(base.price > 0 ? ((targetNumber - base.price) / base.price) * 100 : 0)})`,
      remaining: 0,
      remainingText: '',
    };
  })();

  const presets: { label: string; value: number }[] = (() => {
    if (!base) return [];
    switch (kind) {
      case 'target_value':
        return [10, 25, 50, 100].map((pct) => {
          const v = Math.round(base.value * (1 + pct / 100));
          return { label: `+${pct}% · ${money(v)}`, value: v };
        });
      case 'gain_percent':
        return [5, 10, 20, 50].map((pct) => ({ label: `+${pct}%`, value: pct }));
      case 'asset_quantity':
        if (base.quantity > 0) {
          return [1.5, 2, 3].map((m) => {
            const v = roundQty(base.quantity * m);
            return { label: `×${m} · ${formatQuantity(v)}`, value: v };
          });
        }
        return base.price > 0
          ? [100, 500, 1000].map((amount) => {
              const v = roundQty(amount / base.price);
              return { label: `${money(amount)} · ${formatQuantity(v)}`, value: v };
            })
          : [];
      case 'target_price':
        return base.price > 0
          ? [-20, -10, 10, 25, 50].map((pct) => {
              const v = Number((base.price * (1 + pct / 100)).toPrecision(5));
              return { label: `${pct > 0 ? '+' : ''}${pct}% · ${money(v)}`, value: v };
            })
          : [];
    }
  })();

  const targetField = (n: number) =>
    kind === 'target_value'
      ? { targetValue: n }
      : kind === 'gain_percent'
        ? { targetPercent: n }
        : kind === 'asset_quantity'
          ? { targetQuantity: n }
          : { targetPrice: n };

  const mutation = useMutation({
    mutationFn: () => {
      const finalName = name.trim() || defaultGoalName(kind, targetNumber, money, assetSymbol);
      if (editing) {
        return updateGoal(editing.id, {
          name: finalName,
          ...targetField(targetNumber),
          deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
        });
      }
      return createGoal(portfolioId!, {
        name: finalName,
        kind,
        ...targetField(targetNumber),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59`).toISOString() } : {}),
        ...(assetSymbol ? { assetSymbol } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
      router.back();
    },
  });

  const targetLabel =
    kind === 'target_value'
      ? `Valor objetivo (${currency})`
      : kind === 'gain_percent'
        ? 'Ganancia objetivo (%)'
        : kind === 'asset_quantity'
          ? `Cantidad objetivo${assetSymbol ? ` (${assetSymbol})` : ''}`
          : `Precio objetivo${assetSymbol ? ` de ${assetSymbol}` : ''} (USDT)`;

  return (
    <Screen>
      {editing ? <Stack.Screen options={{ title: 'Editar meta' }} /> : null}
      {editing ? (
        <Muted>{GOAL_KIND_LABELS[editing.kind]}{editing.assetSymbol ? ` · ${editing.assetSymbol}` : ''}</Muted>
      ) : (
        <>
          <SectionTitle>Tipo</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={GOAL_KIND_LABELS[k]}
                selected={kind === k}
                onPress={() => {
                  setKind(k);
                  setTarget('');
                  if (isAssetGoalKind(k) && !assetSymbol) setPickingAsset(true);
                }}
              />
            ))}
          </View>
        </>
      )}

      {editing ? null : (
        <>
          <SectionTitle>{needsAsset ? 'Moneda' : '¿De todo el portafolio o de un activo?'}</SectionTitle>
          {assetSymbol ? (
            <Row>
              <Body style={{ fontWeight: '700' }}>{assetSymbol}</Body>
              <Button
                title={needsAsset ? 'Cambiar moneda' : 'Todo el portafolio'}
                variant="secondary"
                onPress={() => {
                  setAssetSymbol(null);
                  if (needsAsset) setPickingAsset(true);
                }}
              />
            </Row>
          ) : pickingAsset || needsAsset ? (
            <AssetSelector
              held={(positions.data ?? []).map((p) => ({ symbol: p.assetSymbol }))}
              exclude={[]}
              onPick={(s) => {
                setAssetSymbol(s);
                setPickingAsset(false);
              }}
            />
          ) : (
            <Button title="Elegir un activo (opcional)" variant="secondary" onPress={() => setPickingAsset(true)} />
          )}
        </>
      )}

      <TextField label={targetLabel} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {presets.map((pr) => (
          <Chip key={pr.label} label={pr.label} selected={targetNumber === pr.value} onPress={() => setTarget(String(pr.value))} />
        ))}
      </View>

      <TextField
        label="Nombre (opcional)"
        value={name}
        onChangeText={setName}
        placeholder={targetNumber > 0 ? defaultGoalName(kind, targetNumber, money, assetSymbol) : 'Fondo 2027'}
      />

      <SectionTitle>Fecha límite</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label="Sin fecha" selected={!deadline} onPress={() => setDeadline('')} />
        {[
          { label: '3 meses', m: 3 },
          { label: '6 meses', m: 6 },
          { label: '1 año', m: 12 },
        ].map((d) => (
          <Chip key={d.m} label={d.label} selected={deadline === addMonths(d.m)} onPress={() => setDeadline(addMonths(d.m))} />
        ))}
      </View>
      {deadline && ![3, 6, 12].some((m) => addMonths(m) === deadline) ? (
        <Muted style={{ fontSize: 13 }}>Hasta el {new Date(`${deadline}T12:00:00`).toLocaleDateString('es-EC')}</Muted>
      ) : null}

      <Card>
        <SectionTitle>Vista previa</SectionTitle>
        {needsAsset && !assetSymbol ? (
          <Muted>Elige la moneda para ver cuánto falta.</Muted>
        ) : !preview ? (
          <Muted>Cargando tus números…</Muted>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <Row>
              <Muted>{assetSymbol ? `Hoy en ${assetSymbol}` : 'Hoy'}</Muted>
              <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>{preview.current}</Body>
            </Row>
            <ProgressBar value={preview.progress} label="Progreso actual hacia la meta" />
            {targetNumber > 0 ? (
              <>
                <Muted>Objetivo: {preview.target}</Muted>
                {kind === 'target_price' ? (
                  <Muted>Se cumple cuando el precio llegue ahí; queda cumplida aunque después vuelva.</Muted>
                ) : (
                  <Muted>Falta: {preview.remaining > 0 ? preview.remainingText : '¡ya está cumplida!'}</Muted>
                )}
                {monthsLeft !== null && preview.remaining > 0 ? (
                  <Muted>Ritmo necesario: {money(preview.remaining / monthsLeft)} por mes</Muted>
                ) : null}
              </>
            ) : (
              <Muted>Elige un objetivo para ver cuánto falta.</Muted>
            )}
          </View>
        )}
      </Card>

      {mutation.isError ? <ErrorText>{mutation.error.message}</ErrorText> : null}
      <Button
        title={editing ? 'Guardar cambios' : 'Crear meta'}
        onPress={() => mutation.mutate()}
        disabled={!valid}
        loading={mutation.isPending}
      />
    </Screen>
  );
}
