import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  colorOrder,
  distributeRemaining,
  equalize,
  formatCurrency,
  fromCurrent,
  liveSuggestions,
  maxFor,
  MAX_TOTAL,
  setPercent,
  totalOf,
  type DraftRow,
  type RebalancePlan,
} from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Loading, Muted, Row, Screen } from '@/components/ui';
import { AssetSelector, colorAt, ProgressBar, SectionTitle, Stepper } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchTargetAllocation, saveTargetAllocation } from '@/lib/plan-clients';
import { spacing, useTheme } from '@/lib/theme';

// Estrategia: % objetivo por activo y qué comprar o vender para llegar.
export default function StrategyScreen() {
  const queryClient = useQueryClient();
  const { portfolio, isAggregate } = useActivePortfolio();
  const [editing, setEditing] = useState(false);
  const plan = useQuery({
    queryKey: ['target-allocation', portfolio?.id],
    queryFn: () => fetchTargetAllocation(portfolio!.id),
    enabled: !!portfolio && !isAggregate,
  });
  const save = useMutation({
    mutationFn: (rows: DraftRow[]) =>
      saveTargetAllocation(
        portfolio!.id,
        rows.map((r) => ({ assetSymbol: r.assetSymbol, targetPercent: r.percent })),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(['target-allocation', portfolio?.id], updated);
      setEditing(false);
    },
  });

  if (isAggregate) {
    return (
      <Screen>
        <Card>
          <Muted>La estrategia es de cada portafolio: elegí uno (no la vista General).</Muted>
        </Card>
      </Screen>
    );
  }

  const hasTargets = (plan.data?.targetsSum ?? 0) > 0;
  const currency = portfolio?.baseCurrency ?? 'USD';

  return (
    <Screen onRefresh={editing ? undefined : () => void plan.refetch()} refreshing={plan.isRefetching}>
      {plan.isLoading ? <Loading /> : null}
      {plan.error && !plan.data ? <ErrorText>{plan.error.message}</ErrorText> : null}
      {plan.data && editing ? (
        <Editor
          plan={plan.data}
          currency={currency}
          saving={save.isPending}
          error={save.isError ? save.error.message : null}
          onSave={(rows) => save.mutate(rows)}
          onCancel={() => setEditing(false)}
        />
      ) : null}
      {plan.data && !editing ? (
        hasTargets ? (
          <>
            <AllocationView plan={plan.data} currency={currency} />
            <Button title="Editar estrategia" onPress={() => { save.reset(); setEditing(true); }} />
          </>
        ) : (
          <Card>
            <Muted>
              Definí qué % del portafolio querés en cada activo (por ejemplo 60 % BTC, 40 % ETH) y te
              mostramos qué comprar o vender para llegar.
            </Muted>
            <Button title="Armar mi estrategia" onPress={() => setEditing(true)} />
          </Card>
        )
      ) : null}
    </Screen>
  );
}

function Trade({ trade, currency }: { trade: number | null; currency: string }) {
  const t = useTheme();
  if (trade === null) return <Muted style={{ fontSize: 12 }}>queda en lo libre</Muted>;
  if (Math.abs(trade) < 1) return <Muted style={{ fontSize: 12 }}>en objetivo</Muted>;
  const amount = formatCurrency(Math.abs(trade), currency);
  return (
    <Text style={{ fontSize: 13, fontWeight: '600', color: trade > 0 ? t.pnlUp : t.pnlDown }}>
      {trade > 0 ? `Comprar ${amount}` : `Vender ${amount}`}
    </Text>
  );
}

function AllocationView({ plan, currency }: { plan: RebalancePlan; currency: string }) {
  const t = useTheme();
  const order = colorOrder(plan);
  const targeted = plan.rows.filter((r) => r.targetPercent !== null && r.targetPercent > 0);
  return (
    <>
      <Card>
        <SectionTitle>Objetivo</SectionTitle>
        <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: t.surfaceRaised }}>
          {targeted.map((r) => (
            <View key={r.assetSymbol} style={{ width: `${r.targetPercent ?? 0}%`, backgroundColor: colorAt(r.assetSymbol, order) }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {targeted.map((r) => (
            <View key={r.assetSymbol} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorAt(r.assetSymbol, order) }} />
              <Muted style={{ fontSize: 12 }}>
                {r.assetSymbol} {r.targetPercent?.toFixed(1)}%
              </Muted>
            </View>
          ))}
          {plan.targetsSum < 99.99 ? <Muted style={{ fontSize: 12 }}>Libre {(100 - plan.targetsSum).toFixed(1)}%</Muted> : null}
        </View>
      </Card>
      {plan.rows.map((r) => (
        <Card key={r.assetSymbol}>
          <Row>
            <Body style={{ fontWeight: '700' }}>{r.assetSymbol}</Body>
            <Trade trade={r.suggestedTrade} currency={currency} />
          </Row>
          <Muted style={{ fontSize: 13 }}>
            Hoy {r.currentPercent.toFixed(1)}% · objetivo {r.targetPercent === null ? '—' : `${r.targetPercent.toFixed(1)}%`}
          </Muted>
          <ProgressBar value={r.currentPercent / 100} color={colorAt(r.assetSymbol, order)} label={`${r.assetSymbol} actual`} />
          {r.targetPercent !== null ? (
            <ProgressBar value={r.targetPercent / 100} color={t.textMuted} label={`${r.assetSymbol} objetivo`} height={4} />
          ) : null}
        </Card>
      ))}
      <Muted style={{ fontSize: 12 }}>
        Sobre un valor de {formatCurrency(plan.totalValue, currency)}. Barra de color: hoy; barra gris: objetivo.
      </Muted>
    </>
  );
}

function Editor({
  plan,
  currency,
  saving,
  error,
  onSave,
  onCancel,
}: {
  plan: RebalancePlan;
  currency: string;
  saving: boolean;
  error: string | null;
  onSave: (rows: DraftRow[]) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [rows, setRows] = useState<DraftRow[]>(() => {
    const existing = plan.rows
      .filter((r) => r.targetPercent !== null && r.targetPercent > 0)
      .map((r) => ({ assetSymbol: r.assetSymbol, percent: r.targetPercent ?? 0 }));
    return existing.length > 0 ? existing : fromCurrent(plan);
  });
  const [picking, setPicking] = useState(false);
  const order = useMemo(() => colorOrder(plan, rows.map((r) => r.assetSymbol)), [plan, rows]);
  const total = totalOf(rows);
  const remaining = Math.max(0, Math.round((MAX_TOTAL - total) * 100) / 100);
  const suggestions = new Map(liveSuggestions(plan, rows).map((s) => [s.assetSymbol, s]));
  const held = plan.rows
    .filter((r) => r.currentValue > 0)
    .map((r) => ({ symbol: r.assetSymbol, currentPercent: r.currentPercent }));
  const canSave = rows.length > 0 && rows.every((r) => r.percent > 0) && total <= MAX_TOTAL + 0.001;

  return (
    <>
      <Card>
        <Row>
          <Body style={{ fontWeight: '700', color: total === MAX_TOTAL ? t.pnlUp : t.foreground }}>
            Total {total.toFixed(2)}%
          </Body>
          <Muted>{remaining > 0 ? `Libre ${remaining.toFixed(2)}%` : 'Todo asignado'}</Muted>
        </Row>
        <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: t.surfaceRaised }}>
          {rows.map((r) => (
            <View key={r.assetSymbol} style={{ width: `${r.percent}%`, backgroundColor: colorAt(r.assetSymbol, order) }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip label="Igualar" selected={false} onPress={() => setRows(equalize(rows))} />
          <Chip label="Repartir lo que falta" selected={false} onPress={() => setRows(distributeRemaining(rows))} />
          <Chip label="Mi composición actual" selected={false} onPress={() => setRows(fromCurrent(plan))} />
        </View>
      </Card>

      {rows.map((row, i) => {
        const s = suggestions.get(row.assetSymbol);
        return (
          <Card key={row.assetSymbol}>
            <Row>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorAt(row.assetSymbol, order) }} />
                <Body style={{ fontWeight: '700' }}>{row.assetSymbol}</Body>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${row.assetSymbol}`}
                onPress={() => setRows(rows.filter((_, j) => j !== i))}
                hitSlop={8}
              >
                <Text style={{ color: t.textMuted, fontSize: 18 }}>✕</Text>
              </Pressable>
            </Row>
            <Row>
              <Stepper
                label={row.assetSymbol}
                value={row.percent}
                max={maxFor(rows, i)}
                onChange={(v) => setRows(setPercent(rows, i, v))}
              />
              <Trade trade={s?.trade ?? null} currency={currency} />
            </Row>
            <Muted style={{ fontSize: 12 }}>Hoy {s ? s.currentPercent.toFixed(1) : '0.0'}%</Muted>
          </Card>
        );
      })}

      {picking ? (
        <Card>
          <AssetSelector
            held={held}
            exclude={rows.map((r) => r.assetSymbol)}
            onPick={(symbol) => {
              setRows([...rows, { assetSymbol: symbol, percent: Math.min(10, remaining) }]);
              setPicking(false);
            }}
          />
          <Button title="Cerrar" variant="secondary" onPress={() => setPicking(false)} />
        </Card>
      ) : (
        <Button
          title={remaining > 0 ? '+ Agregar activo' : 'Bajá algún % para agregar otro'}
          variant="secondary"
          onPress={() => setPicking(true)}
          disabled={remaining <= 0}
        />
      )}

      {rows.some((r) => r.percent <= 0) ? <ErrorText>Hay activos en 0 %: subiles el % o quitálos.</ErrorText> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Guardar estrategia" onPress={() => onSave(rows)} disabled={!canSave} loading={saving} />
      <Button title="Cancelar" variant="secondary" onPress={onCancel} />
    </>
  );
}
