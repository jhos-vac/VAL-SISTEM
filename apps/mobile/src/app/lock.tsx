import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorText, Muted, Screen, Title } from '@/components/ui';
import { authenticateWithBiometrics } from '@/lib/biometrics';
import { logout, resumeSession } from '@/lib/session';
import { spacing } from '@/lib/theme';

const PROMPT = 'Desbloquear VAL-SISTEM';

// Sesión guardada + biometría activada: hay que autenticarse antes de
// renovar el access token y entrar.
export default function LockScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // El pedido de huella / Face ID se muestra solo al abrir la pantalla.
  // Si se cancela, queda el botón para reintentar.
  useEffect(() => {
    void authenticateWithBiometrics(PROMPT).then((ok) => (ok ? resumeSession() : undefined));
  }, []);

  async function unlock() {
    setError(null);
    setBusy(true);
    try {
      if (await authenticateWithBiometrics(PROMPT)) {
        await resumeSession();
      } else {
        setError('No se pudo verificar tu identidad.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
        <Title>Sesión bloqueada</Title>
        <Muted>Usá tu huella o Face ID para continuar.</Muted>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button title="Desbloquear" onPress={unlock} loading={busy} />
        <Button title="Usar otra cuenta" variant="secondary" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}
