import { useState } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Body, Button, Card, ErrorText, Loading, Muted, Row, Screen, TextField } from '@/components/ui';
import {
  connectExchangeAccount,
  disconnectExchangeAccount,
  fetchExchangeAccounts,
  syncExchangeAccount,
} from '@/lib/clients';

// Conexión de Binance con una API key de SOLO LECTURA. La key viaja al
// backend, que la valida y la guarda cifrada; el teléfono no la guarda.
export default function ExchangeScreen() {
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ['exchange-accounts'], queryFn: fetchExchangeAccounts });
  const [label, setLabel] = useState('Binance');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const connect = useMutation({
    mutationFn: () => connectExchangeAccount({ label: label.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
    onSuccess: async (res) => {
      setApiKey('');
      setApiSecret('');
      await queryClient.invalidateQueries();
      Alert.alert('Cuenta conectada', [res.warning, res.syncMessage].filter(Boolean).join('\n\n'));
    },
    onError: (err) => setError(err.message),
  });

  const sync = useMutation({
    mutationFn: syncExchangeAccount,
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      const title = { completed: 'Sincronizado', skipped: 'Sincronización en curso', failed: 'Falló la sincronización' };
      Alert.alert(title[res.status], res.message);
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const disconnect = useMutation({
    mutationFn: disconnectExchangeAccount,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const confirmDisconnect = (id: string, label: string) =>
    Alert.alert(
      'Desconectar cuenta',
      `¿Desconectar "${label}"? Se borran la API key y las posiciones que vinieron de Binance. Tus movimientos manuales no se tocan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desconectar', style: 'destructive', onPress: () => disconnect.mutate(id) },
      ],
    );

  return (
    <Screen onRefresh={() => void accounts.refetch()} refreshing={accounts.isRefetching}>
      {accounts.isLoading ? <Loading /> : null}
      {accounts.data?.map((a) => (
        <Card key={a.id}>
          <Row>
            <Body style={{ fontWeight: '600' }}>{a.label}</Body>
            <Muted>•••• {a.apiKeyLast4}</Muted>
          </Row>
          <Muted>
            {a.lastSyncedAt
              ? `Última sincronización: ${new Date(a.lastSyncedAt).toLocaleString('es-EC')}`
              : 'Todavía no se sincronizó'}
          </Muted>
          {a.lastSyncMessage ? (
            a.status === 'failed' ? <ErrorText>{a.lastSyncMessage}</ErrorText> : <Muted style={{ fontSize: 13 }}>{a.lastSyncMessage}</Muted>
          ) : null}
          <Button
            title="Sincronizar ahora"
            variant="secondary"
            onPress={() => sync.mutate(a.id)}
            loading={sync.isPending && sync.variables === a.id}
          />
          <Button
            title="Desconectar"
            variant="danger"
            onPress={() => confirmDisconnect(a.id, a.label)}
            loading={disconnect.isPending && disconnect.variables === a.id}
          />
        </Card>
      ))}

      <Card>
        <Body style={{ fontWeight: '600' }}>Conectar una cuenta</Body>
        <Muted>
          En Binance creá una API key con solo el permiso &quot;Enable Reading&quot;. Nunca actives retiros ni
          trading.
        </Muted>
        <TextField label="Nombre" value={label} onChangeText={setLabel} />
        <TextField label="API key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} />
        <TextField
          label="API secret"
          value={apiSecret}
          onChangeText={setApiSecret}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          title="Conectar"
          onPress={() => {
            if (!apiKey.trim() || !apiSecret.trim()) return setError('Pegá la API key y el secret.');
            setError(null);
            connect.mutate();
          }}
          loading={connect.isPending}
        />
      </Card>
    </Screen>
  );
}
