import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router, SplashScreen, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE, queryClient, queryPersister } from '@/lib/query';
import { bootstrapSession } from '@/lib/session';
import { registerForPush } from '@/lib/push';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/store/auth';
import { notificationRoute } from '@/lib/alerts-clients';

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

  // Tocar una notificación push abre la pantalla del aviso.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = response.notification.request.content.data?.link;
      const route = notificationRoute(typeof link === 'string' ? link : null);
      router.push(route ?? '/notifications');
    });
    return () => sub.remove();
  }, [status]);

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
          headerStyle: { backgroundColor: t.background },
          headerShadowVisible: false,
          headerTintColor: t.foreground,
          headerTitleStyle: { fontWeight: '700' },
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
          <Stack.Screen name="market" options={{ title: 'Mercado' }} />
          <Stack.Screen name="lots" options={{ title: 'Rendimiento por compra' }} />
          <Stack.Screen name="goals" options={{ title: 'Metas' }} />
          <Stack.Screen name="goal-new" options={{ title: 'Nueva meta', presentation: 'modal' }} />
          <Stack.Screen name="strategy" options={{ title: 'Estrategia' }} />
          <Stack.Screen name="dca" options={{ title: 'Compras periódicas' }} />
          <Stack.Screen name="dca-new" options={{ title: 'Nuevo plan', presentation: 'modal' }} />
          <Stack.Screen name="explore" options={{ title: 'Explorar' }} />
          <Stack.Screen name="explore-detail" options={{ title: 'Portafolio público' }} />
          <Stack.Screen name="portfolio-edit" options={{ title: 'Portafolio', presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
          <Stack.Screen name="preferences" options={{ title: 'Preferencias' }} />
          <Stack.Screen name="capital" options={{ title: 'Moneda capital' }} />
          <Stack.Screen name="review" options={{ title: 'Revisión' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="alerts" options={{ title: 'Avisos' }} />
          <Stack.Screen name="watchlist" options={{ title: 'Seguimiento' }} />
        </Stack.Protected>
      </Stack>
    </PersistQueryClientProvider>
  );
}
