import { useState } from 'react';
import { Button, Card, ErrorText, Muted, Screen, TextField } from '@/components/ui';
import { forgotPassword } from '@/lib/session';

// El link de recuperación abre la web (reset-password); la app solo pide
// el email.
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!email.trim()) {
      setError('Ingresá tu email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el email.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <Card>
          <Muted>
            Si existe una cuenta con ese email, te enviamos un link para crear una contraseña nueva.
          </Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Muted>Te enviaremos un link para crear una contraseña nueva.</Muted>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Enviar link" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
