import { useState } from 'react';
import { Button, Card, ErrorText, Muted, Screen, TextField } from '@/components/ui';
import { deleteAccount } from '@/lib/session';

// Borrado de cuenta desde la app (App Store y Google Play lo exigen a las
// apps que permiten crear cuentas). Al terminar, el layout raíz lleva al
// login porque la sesión local queda vacía.
export default function DeleteAccountScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!password) {
      setError('Ingresá tu contraseña para confirmar.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Muted>
          Se borran tu cuenta, tus portafolios, posiciones, transacciones y las cuentas de Binance
          conectadas. No se puede deshacer.
        </Muted>
      </Card>
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Eliminar definitivamente" variant="danger" onPress={onDelete} loading={loading} />
    </Screen>
  );
}
