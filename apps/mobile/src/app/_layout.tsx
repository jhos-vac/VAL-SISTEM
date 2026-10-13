import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SplashScreen, Stack } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE, queryClient, queryPersister } from '@/lib/query';
import { bootstrapSession } from '@/lib/session';
import { registerForPush } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const t = useTheme();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (status !== 'idle') SplashScreen.hide();
  }, [status]);

  // Registro del push token cada vez que hay sesión online (el backend
  // hace upsert por token, así que repetirlo no duplica dispositivos).
  useEffect(() => {
    if (status === 'authenticated' && accessToken) {
      registerForPush().catch(() => {
        // Sin permiso o sin red: se reintenta en el próximo inicio.
      });
    }
  }, [status, accessToken]);

  if (status === 'idle') return null;

  const signedIn = status === 'authenticated';

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE }}
    >
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface },
          headerTintColor: t.foreground,
          contentStyle: { backgroundColor: t.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Protected guard={status === 'unauthenticated'}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="lock" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="transaction-new"
            options={{ title: 'Nueva transacción', presentation: 'modal' }}
          />
          <Stack.Screen name="portfolios" options={{ title: 'Portafolios', presentation: 'modal' }} />
          <Stack.Screen name="exchange" options={{ title: 'Binance' }} />
          <Stack.Screen name="delete-account" options={{ title: 'Eliminar cuenta' }} />
        </Stack.Protected>
      </Stack>
    </PersistQueryClientProvider>
  );
}
