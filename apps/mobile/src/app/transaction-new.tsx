import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TRANSACTION_TYPE_LABELS, type TransactionType } from '@val-sistem/shared';
import { Button, Chip, ErrorText, Muted, Screen, TextField } from '@/components/ui';
import { useActivePortfolio } from '@/hooks/useActivePortfolio';
import { createTransaction, getOrCreateManualWallet } from '@/lib/clients';
import { spacing } from '@/lib/theme';

// Acepta coma o punto decimal (teclados en español usan coma).
const parseNumber = (s: string) => Number(s.trim().replace(',', '.'));

export default function NewTransactionScreen() {
  const { portfolio } = useActivePortfolio();
  const queryClient = useQueryClient();
  const [type, setType] = useState<TransactionType>('buy');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const wallet = await getOrCreateManualWallet(portfolio!.id);
      return createTransaction({
        walletId: wallet.id,
        assetSymbol: symbol.trim().toUpperCase(),
        type,
        quantity: parseNumber(quantity),
        price: parseNumber(price),
        fee: fee ? parseNumber(fee) : undefined,
        executedAt: new Date().toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => setError(err.message),
  });

  function onSubmit() {
    const q = parseNumber(quantity);
    const p = parseNumber(price);
    if (!symbol.trim()) return setError('Ingresá el activo (por ejemplo BTC).');
    if (!(q > 0)) return setError('La cantidad debe ser mayor a 0.');
    if (!(p >= 0) || price.trim() === '') return setError('Ingresá un precio válido.');
    if (fee && !(parseNumber(fee) >= 0)) return setError('La comisión no es válida.');
    setError(null);
    mutation.mutate();
  }

  if (!portfolio) return null;

  return (
    <Screen>
      <Muted>Portafolio: {portfolio.name}</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((key) => (
          <Chip key={key} label={TRANSACTION_TYPE_LABELS[key]} selected={type === key} onPress={() => setType(key)} />
        ))}
      </ScrollView>
      <TextField
        label="Activo"
        placeholder="BTC"
        value={symbol}
        onChangeText={setSymbol}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <TextField label="Cantidad" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
      <TextField label="Precio por unidad (USD)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <TextField label="Comisión (opcional)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Guardar" onPress={onSubmit} loading={mutation.isPending} />
    </Screen>
  );
}
