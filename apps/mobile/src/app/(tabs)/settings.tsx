import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Body, Button, Card, Muted, Row, Screen } from '@/components/ui';
import { PalettePicker } from '@/components/PalettePicker';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/lib/biometrics';
import { fetchProfile, updateSettings } from '@/lib/clients';
import { APP_VERSION } from '@/lib/config';
import { secure } from '@/lib/secure';
import { logout } from '@/lib/session';
import { useTheme } from '@/lib/theme';

export default function SettingsScreen() {
  const t = useTheme();
  const profile = useQuery({ queryKey: ['me'], queryFn: fetchProfile });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    void isBiometricAvailable().then(setBiometricAvailable);
    void secure.getBiometricEnabled().then(setBiometricEnabled);
  }, []);

  async function toggleBiometric(next: boolean) {
    // Confirmar con la biometría antes de activarla, así no queda
    // activada en un teléfono donde no funciona.
    if (next && !(await authenticateWithBiometrics('Activar desbloqueo biométrico'))) return;
    await secure.setBiometricEnabled(next);
    setBiometricEnabled(next);
    updateSettings({ biometricEnabled: next }).catch(() => {
      // La preferencia que manda es la local; el backend es solo registro.
    });
  }

  function confirmLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Body style={{ fontWeight: '600' }}>
          {profile.data ? `${profile.data.firstName} ${profile.data.lastName}` : 'Tu cuenta'}
        </Body>
        {profile.data ? <Muted>{profile.data.email}</Muted> : null}
      </Card>

      <Card>
        <Row>
          <Body>Desbloqueo con huella / Face ID</Body>
          <Switch
            accessibilityLabel="Desbloqueo biométrico"
            value={biometricEnabled}
            onValueChange={(v) => void toggleBiometric(v)}
            disabled={!biometricAvailable}
            trackColor={{ true: t.primary, false: t.surfaceRaised }}
          />
        </Row>
        {!biometricAvailable ? (
          <Muted>Este teléfono no tiene biometría configurada.</Muted>
        ) : (
          <Muted>Al abrir la app se pedirá tu huella o Face ID.</Muted>
        )}
      </Card>

      <PalettePicker />

      <Button title="Conexión con Binance" variant="secondary" onPress={() => router.push('/exchange')} />
      <Button title="Cerrar sesión" variant="secondary" onPress={confirmLogout} />
      <Button title="Eliminar cuenta" variant="danger" onPress={() => router.push('/delete-account')} />
      <Muted style={{ textAlign: 'center' }}>Versión {APP_VERSION}</Muted>
    </Screen>
  );
}
