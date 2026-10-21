import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DCA_FREQUENCY_LABELS, formatCurrency, type DcaFrequency } from '@val-sistem/shared';
import { Body, Button, Card, Chip, ErrorText, Muted, Row, Screen, TextField } from '@/components/ui';
import { AssetSelector, SectionTitle } from '@/components/plan';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { fetchPositions } from '@/lib/clients';
import { createDcaPlan } from '@/lib/plan-clients';
import { spacing } from '@/lib/theme';

function addPeriods(start: Date, frequency: DcaFrequency, n: number): Date {
  const d = new Date(start.getTime());
  if (frequency === 'monthly') d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n * (frequency === 'weekly' ? 7 : 14));
  return d;
}

function purchasesWithin(start: Date, frequency: DcaFrequency, months: number): number {
  const end = new Date(start.getTime());
  end.setMonth(end.getMonth() + months);
  let n = 0;
  while (addPeriods(start, frequency, n) < end) n++;
  return n;
}

// Nuevo plan DCA con proyección en vivo. Puede venir precargado desde una
// meta (moneda, monto semanal y fecha de fin).
export default function NewDcaScreen() {
  const params = useLocalSearchParams<{ asset?: string; amount?: string; endDate?: string }>();
  const queryClient = useQueryClient();
  const { portfolio } = useActivePortfolio();
  const currency = portfolio?.baseCurrency ?? 'USD';
  const money = (n: number) => formatCurrency(n, currency);
  const presets = useMemo(() => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    return [
      { label: 'Hoy', date: iso(today) },
      { label: 'Próximo lunes', date: iso(monday) },
      { label: '1° del mes', date: iso(new Date(today.getFullYear(), today.getMonth() + 1, 1)) },
    ];
  }, []);
  const [assetSymbol, setAssetSymbol] = useState<string | null>(params.asset || null);
  const [amount, setAmount] = useState(params.amount || '50');
  const endDate = params.endDate || undefined;
  const [frequency, setFrequency] = useState<DcaFrequency>('weekly');
  const [startDate, setStartDate] = useState(presets[0].date);

  const positions = useQuery({
    queryKey: ['positions', portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });

  const amountNumber = Number(amount.trim().replace(',', '.'));
  const start = new Date(`${startDate}T00:00:00`);
  const next = [0, 1, 2, 3].map((n) => addPeriods(start, frequency, n));
  const valid = !!assetSymbol && amountNumber > 0;

  const mutation = useMutation({
    mutationFn: () =>
      createDcaPlan(portfolio!.id, {
        assetSymbol: assetSymbol!,
        amount: amountNumber,
        frequency,
        startDate: start.toISOString(),
        ...(endDate ? { endDate } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dca-plans'] });
      router.back();
    },
  });

  return (
    <Screen>
      <SectionTitle>Activo</SectionTitle>
      {assetSymbol ? (
        <Row>
          <Body style={{ fontWeight: '700' }}>{assetSymbol}</Body>
          <Button title="Cambiar" variant="secondary" onPress={() => setAssetSymbol(null)} />
        </Row>
      ) : (
        <AssetSelector
          held={(positions.data ?? []).map((p) => ({ symbol: p.assetSymbol }))}
          exclude={[]}
          onPick={setAssetSymbol}
        />
      )}

      <TextField label={`Monto por compra (${currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {[25, 50, 100, 250].map((a) => (
          <Chip key={a} label={money(a)} selected={amountNumber === a} onPress={() => setAmount(String(a))} />
        ))}
      </View>

      <SectionTitle>Frecuencia</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(Object.keys(DCA_FREQUENCY_LABELS) as DcaFrequency[]).map((f) => (
          <Chip key={f} label={DCA_FREQUENCY_LABELS[f]} selected={frequency === f} onPress={() => setFrequency(f)} />
        ))}
      </View>

      <SectionTitle>Empieza</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} selected={startDate === p.date} onPress={() => setStartDate(p.date)} />
        ))}
      </View>

      {endDate ? (
        <Muted style={{ fontSize: 13 }}>
          Plan sugerido por tu meta: termina el {new Date(endDate).toLocaleDateString('es-EC')}.
        </Muted>
      ) : null}

      <Card>
        <SectionTitle>Proyección</SectionTitle>
        {[6, 12].map((months) => {
          const n = purchasesWithin(start, frequency, months);
          return (
            <Row key={months}>
              <Muted>{months === 12 ? 'En 1 año' : 'En 6 meses'}</Muted>
              <Body style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {money(n * (amountNumber || 0))} · {n} compras
              </Body>
            </Row>
          );
        })}
        <Muted style={{ fontSize: 12 }}>Próximas compras</Muted>
        {next.map((d, i) => (
          <Muted key={i} style={{ fontSize: 13 }}>
            • {d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Muted>
        ))}
      </Card>

      {mutation.isError ? <ErrorText>{mutation.error.message}</ErrorText> : null}
      <Button title="Crear plan" onPress={() => mutation.mutate()} disabled={!valid} loading={mutation.isPending} />
    </Screen>
  );
}
