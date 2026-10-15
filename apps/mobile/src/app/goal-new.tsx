import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatPercent, type GoalKind } from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Muted, Row, Screen, TextField } from '@/components/ui';
import { AssetSelector, ProgressBar, SectionTitle } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions, fetchSummary } from '@/lib/clients';
import { createGoal } from '@/lib/plan-clients';
import { spacing } from '@/lib/theme';

const DAY_MS = 86_400_000;
const parseNumber = (s: string) => Number(s.trim().replace(',', '.'));

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Nueva meta: tipo, objetivo con atajos, fecha rápida, activo opcional y
// vista previa en vivo.
export default function NewGoalScreen() {
  const queryClient = useQueryClient();
  const { portfolio } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const [now] = useState(() => Date.now());
  const [kind, setKind] = useState<GoalKind>('target_value');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);
  const [pickingAsset, setPickingAsset] = useState(false);

  const summary = useQuery({
    queryKey: ['portfolio-summary', portfolio?.id],
    queryFn: () => fetchSummary(portfolio!.id),
    enabled: !!portfolio,
  });
  const positions = useQuery({
    queryKey: ['positions', portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });

  const base = useMemo(() => {
    if (assetSymbol) {
      const own = (positions.data ?? []).filter((p) => p.assetSymbol === assetSymbol);
      return {
        value: own.reduce((s, p) => s + p.currentValue, 0),
        invested: own.reduce((s, p) => s + p.quantity * p.averageCost, 0),
        gain: own.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0),
      };
    }
    if (!summary.data) return null;
    return {
      value: summary.data.totalValue,
      invested: summary.data.totalInvested,
      gain: summary.data.unrealizedPnl + summary.data.realizedPnl,
    };
  }, [assetSymbol, positions.data, summary.data]);

  const targetNumber = parseNumber(target);
  const valid = name.trim().length > 0 && targetNumber > 0;
  const currentPercent = base && base.invested > 0 ? (base.gain / base.invested) * 100 : 0;
  const targetValue = kind === 'target_value' ? targetNumber : base ? base.invested * (1 + targetNumber / 100) : 0;
  const remaining = base ? Math.max(0, targetValue - base.value) : 0;
  const monthsLeft = deadline
    ? Math.max((new Date(`${deadline}T23:59:59`).getTime() - now) / (30.44 * DAY_MS), 1 / 30)
    : null;
  const progress =
    kind === 'target_value'
      ? base && targetNumber > 0 ? base.value / targetNumber : 0
      : targetNumber > 0 ? currentPercent / targetNumber : 0;

  const mutation = useMutation({
    mutationFn: () =>
      createGoal(portfolio!.id, {
        name: name.trim(),
        kind,
        ...(kind === 'target_value' ? { targetValue: targetNumber } : { targetPercent: targetNumber }),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59`).toISOString() } : {}),
        ...(assetSymbol ? { assetSymbol } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals'] });
      router.back();
    },
  });

  return (
    <Screen>
      <SectionTitle>Tipo</SectionTitle>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label={`Llegar a un valor (${currency})`} selected={kind === 'target_value'} onPress={() => { setKind('target_value'); setTarget(''); }} />
        <Chip label="Ganar un %" selected={kind === 'gain_percent'} onPress={() => { setKind('gain_percent'); setTarget(''); }} />
      </View>

      <TextField label="Nombre" value={name} onChangeText={setName} placeholder={kind === 'target_value' ? 'Fondo 2027' : 'BTC +10 %'} />

      <TextField
        label={kind === 'target_value' ? `Valor objetivo (${currency})` : 'Ganancia objetivo (%)'}
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {kind === 'target_value'
          ? base
            ? [10, 25, 50, 100].map((pct) => {
                const v = Math.round(base.value * (1 + pct / 100));
                return <Chip key={pct} label={`+${pct}% · ${money(v)}`} selected={targetNumber === v} onPress={() => setTarget(String(v))} />;
              })
            : null
          : [5, 10, 20, 50].map((pct) => (
              <Chip key={pct} label={`+${pct}%`} selected={targetNumber === pct} onPress={() => setTarget(String(pct))} />
            ))}
      </View>

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

      <SectionTitle>¿De todo el portafolio o de un activo?</SectionTitle>
      {assetSymbol ? (
        <Row>
          <Body style={{ fontWeight: '700' }}>{assetSymbol}</Body>
          <Button title="Todo el portafolio" variant="secondary" onPress={() => setAssetSymbol(null)} />
        </Row>
      ) : pickingAsset ? (
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

      <Card>
        <SectionTitle>Vista previa</SectionTitle>
        {!base ? (
          <Muted>Cargando tus números…</Muted>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <Row>
              <Muted>{assetSymbol ? `Hoy en ${assetSymbol}` : 'Hoy'}</Muted>
              <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {kind === 'target_value' ? money(base.value) : formatPercent(currentPercent)}
              </Body>
            </Row>
            <ProgressBar value={progress} label="Progreso actual hacia la meta" />
            {targetNumber > 0 ? (
              <>
                <Muted>
                  Objetivo: {kind === 'target_value' ? money(targetNumber) : `${formatPercent(targetNumber)} (${money(targetValue)})`}
                </Muted>
                <Muted>Falta: {remaining > 0 ? money(remaining) : '¡ya está cumplida!'}</Muted>
                {monthsLeft !== null && remaining > 0 ? (
                  <Muted>Ritmo necesario: {money(remaining / monthsLeft)} por mes</Muted>
                ) : null}
              </>
            ) : (
              <Muted>Elegí un objetivo para ver cuánto falta.</Muted>
            )}
          </View>
        )}
      </Card>

      {mutation.isError ? <ErrorText>{mutation.error.message}</ErrorText> : null}
      <Button title="Crear meta" onPress={() => mutation.mutate()} disabled={!valid} loading={mutation.isPending} />
    </Screen>
  );
}
