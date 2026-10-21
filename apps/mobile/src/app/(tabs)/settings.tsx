import { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Body, Button, Card, MenuItem, Muted, Row, Screen } from '@/components/ui';
import { authenticateWithBiometrics, isBiometricAvailable } from '@/lib/biometrics';
import { updateSettings } from '@/lib/clients';
import { APP_VERSION } from '@/lib/config';
import { secure } from '@/lib/secure';
import { logout } from '@/lib/session';
import { spacing, useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';

export default function SettingsScreen() {
  const t = useTheme();
  const user = useAuthStore((s) => s.user);
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
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  return (
    <Screen>
      <Card variant="inverse">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar text={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.foreground, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
              {user ? `${user.firstName} ${user.lastName}` : 'Tu cuenta'}
            </Text>
            <Muted style={{ fontSize: 13 }}>{user ? `@${user.username} · ${user.email}` : ''}</Muted>
          </View>
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <MenuItem icon="person-outline" title="Perfil" description="Nombre y usuario" onPress={() => router.push('/profile')} />
        <MenuItem
          icon="options-outline"
          title="Preferencias"
          description="Modo, colores, moneda, idioma y zona horaria"
          onPress={() => router.push('/preferences')}
        />
        <MenuItem
          icon="wallet-outline"
          title="Moneda capital"
          description="Monedas que usas como dinero (USDT…)"
          onPress={() => router.push('/capital')}
        />
        <MenuItem
          icon="briefcase-outline"
          title="Portafolios"
          description="Crear, editar y publicar en el ranking"
          onPress={() => router.push('/portfolios')}
        />
        <MenuItem
          icon="link-outline"
          title="Conexión con Binance"
          description="Conectar, sincronizar o desconectar"
          onPress={() => router.push('/exchange')}
        />
      </View>

      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>Desbloqueo con huella / Face ID</Body>
            <Muted style={{ fontSize: 13 }}>
              {biometricAvailable ? 'Al abrir la app se pedirá tu huella o Face ID.' : 'Este teléfono no tiene biometría configurada.'}
            </Muted>
          </View>
          <Switch
            accessibilityLabel="Desbloqueo biométrico"
            value={biometricEnabled}
            onValueChange={(v) => void toggleBiometric(v)}
            disabled={!biometricAvailable}
            trackColor={{ true: t.primary, false: t.surfaceRaised }}
          />
        </Row>
      </Card>

      <Button title="Cerrar sesión" variant="secondary" icon="log-out-outline" onPress={confirmLogout} />
      <Button title="Eliminar cuenta" variant="danger" onPress={() => router.push('/delete-account')} />
      <Muted style={{ textAlign: 'center' }}>Versión {APP_VERSION}</Muted>
    </Screen>
  );
}
