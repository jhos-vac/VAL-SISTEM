import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, ErrorText, Muted, Screen, TextField, Title } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { login } from '@/lib/session';
import { spacing, useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      setError('Ingresá tu email y contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // Al guardar la sesión, el layout raíz cambia a las tabs.
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(
        err instanceof ApiError && err.isNetworkError
          ? 'No se pudo conectar con el servidor. Si es la primera vez en un rato, puede tardar hasta un minuto en despertar.'
          : err instanceof Error
            ? err.message
            : 'No se pudo iniciar sesión.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ gap: spacing.xs, marginTop: spacing.xl * 2 }}>
          <Title>VAL-SISTEM</Title>
          <Muted>Iniciá sesión para ver tus inversiones.</Muted>
        </View>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={onSubmit}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button title="Iniciar sesión" onPress={onSubmit} loading={loading} />
        <View style={{ gap: spacing.md, alignItems: 'center' }}>
          <Link href="/forgot-password" style={{ color: t.primary, fontSize: 15, padding: spacing.sm }}>
            Olvidé mi contraseña
          </Link>
          <Link href="/register" style={{ color: t.primary, fontSize: 15, padding: spacing.sm }}>
            Crear una cuenta
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
