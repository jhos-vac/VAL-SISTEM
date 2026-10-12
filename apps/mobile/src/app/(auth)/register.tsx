import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, ErrorText, Screen, TextField } from '@/components/ui';
import { register } from '@/lib/session';

const EMPTY = { firstName: '', lastName: '', username: '', email: '', password: '' };

export default function RegisterScreen() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit() {
    if (Object.values(form).some((v) => !v.trim())) {
      setError('Completá todos los campos.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim() });
      Alert.alert('Cuenta creada', 'Ya podés iniciar sesión.');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <TextField label="Nombre" value={form.firstName} onChangeText={set('firstName')} autoComplete="given-name" />
      <TextField label="Apellido" value={form.lastName} onChangeText={set('lastName')} autoComplete="family-name" />
      <TextField
        label="Usuario"
        value={form.username}
        onChangeText={set('username')}
        autoCapitalize="none"
        autoComplete="username"
      />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField
        label="Contraseña"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Crear cuenta" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
