// TanStack Query con caché persistida en AsyncStorage: sin conexión, la
// app muestra los últimos datos descargados (modo offline mínimo).
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ApiError } from './api';

const DAY_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Debe ser >= maxAge de la persistencia, si no la caché se descarta.
      gcTime: 7 * DAY_MS,
      staleTime: 60_000,
      // 'offlineFirst': sin red se usan los datos en caché sin quedar
      // "pausado" para siempre esperando conexión.
      networkMode: 'offlineFirst',
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'val.queryCache',
  throttleTime: 2000,
});

export const PERSIST_MAX_AGE = 7 * DAY_MS;

// Estado de red y foco de la app, para que Query reintente al volver la
// conexión o al traer la app al frente.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});
