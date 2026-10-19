import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, ErrorText, Muted, Screen, TextField } from '@/components/ui';
import { updateProfile } from '@/lib/clients';
import { useAuthStore } from '@/store/auth';

// Editar nombre, apellido y usuario. El email no se cambia desde acá.
export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');

  const save = useMutation({
    mutationFn: () =>
      updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), username: username.trim() }),
    onSuccess: (updated) => {
      const { accessToken } = useAuthStore.getState();
      if (accessToken) useAuthStore.getState().setSession(updated, accessToken);
      queryClient.setQueryData(['me'], updated);
      router.back();
    },
  });

  const valid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && username.trim().length >= 3;

  return (
    <Screen>
      <TextField label="Nombre" value={firstName} onChangeText={setFirstName} maxLength={80} />
      <TextField label="Apellido" value={lastName} onChangeText={setLastName} maxLength={80} />
      <TextField label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} />
      <Muted style={{ fontSize: 13 }}>Email: {user?.email}</Muted>
      {save.isError ? <ErrorText>{save.error.message}</ErrorText> : null}
      <Button title="Guardar" onPress={() => save.mutate()} disabled={!valid} loading={save.isPending} />
    </Screen>
  );
}
