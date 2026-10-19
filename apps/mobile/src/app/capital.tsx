import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALL_PORTFOLIOS_ID } from '@val-sistem/shared';
import { Card, Chip, ErrorText, Loading, Muted, Screen } from '@/components/ui';
import { fetchPositions } from '@/lib/clients';
import { fetchAssets, fetchCapitalAssets, updateCapitalAssets } from '@/lib/plan-clients';
import { spacing } from '@/lib/theme';

// Stablecoins que se ofrecen aunque todavía no las tengas.
const SUGGESTED = ['USDT', 'USDC', 'FDUSD', 'DAI'];

// Monedas capital: las que se usan como dinero (p. ej. USDT). Se muestran
// solo como "Capital" y no cuentan en portafolios ni ganancias.
export default function CapitalScreen() {
  const queryClient = useQueryClient();
  const selected = useQuery({ queryKey: ['capital-assets'], queryFn: fetchCapitalAssets });
  const positions = useQuery({
    queryKey: ['positions', ALL_PORTFOLIOS_ID],
    queryFn: () => fetchPositions(ALL_PORTFOLIOS_ID),
  });
  const catalog = useQuery({ queryKey: ['market-assets'], queryFn: fetchAssets });

  const save = useMutation({
    mutationFn: updateCapitalAssets,
    onSuccess: async (saved) => {
      queryClient.setQueryData(['capital-assets'], saved);
      // Cambia cómo se calculan resumen, posiciones y rendimiento.
      await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'capital-assets' });
    },
  });

  const catalogSymbols = new Set((catalog.data ?? []).map((a) => a.symbol));
  const current = save.isPending ? (save.variables ?? []) : (selected.data ?? []);
  const options = [
    ...new Set([
      ...(selected.data ?? []),
      ...(positions.data ?? []).map((p) => p.assetSymbol),
      ...SUGGESTED.filter((s) => catalogSymbols.has(s)),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const toggle = (symbol: string) =>
    save.mutate(current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol]);

  return (
    <Screen>
      <Card variant="mint">
        <Muted>
          Marca las monedas que usas como dinero y no como inversión (por ejemplo USDT, como dólares virtuales). Se
          muestran solo como “Capital” en el inicio y no cuentan en portafolios, posiciones, estrategia, ranking ni
          ganancias.
        </Muted>
      </Card>
      {selected.isLoading ? <Loading /> : null}
      {options.length === 0 && !selected.isLoading ? <Muted>Todavía no tienes monedas para elegir.</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((s) => (
          <Chip key={s} label={current.includes(s) ? `✓ ${s}` : s} selected={current.includes(s)} onPress={() => toggle(s)} />
        ))}
      </View>
      {save.isError ? <ErrorText>{save.error.message}</ErrorText> : null}
    </Screen>
  );
}
