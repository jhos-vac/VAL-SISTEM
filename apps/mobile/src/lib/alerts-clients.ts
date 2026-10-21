// Avisos, centro de notificaciones y lista de seguimiento (mismo contrato
// que apps/web/src/lib/alerts-client.ts).
import type { Href } from 'expo-router';
import type {
  AlertsOverview,
  CreateAlertInput,
  NotificationList,
  WatchlistItem,
} from '@val-sistem/shared';
import { requestWithAuth } from './session';

export const fetchAlerts = () => requestWithAuth<AlertsOverview>('/alerts');

export const createAlert = (input: CreateAlertInput) =>
  requestWithAuth<AlertsOverview>('/alerts/rules', { method: 'POST', body: JSON.stringify(input) });

export const updateAlert = (id: string, input: { isActive?: boolean; threshold?: number; repeat?: boolean }) =>
  requestWithAuth<AlertsOverview>(`/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(input) });

export const deleteAlert = (id: string) =>
  requestWithAuth<AlertsOverview>(`/alerts/rules/${id}`, { method: 'DELETE' });

export const setAutoAlert = (kind: 'goal_events' | 'dca_due', enabled: boolean) =>
  requestWithAuth<AlertsOverview>('/alerts/auto', { method: 'PUT', body: JSON.stringify({ kind, enabled }) });

export const fetchNotifications = (limit = 50) =>
  requestWithAuth<NotificationList>(`/notifications?limit=${limit}`);

export const markNotificationsRead = (ids?: string[]) =>
  requestWithAuth<{ unreadCount: number }>('/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  });

export const fetchWatchlist = () => requestWithAuth<WatchlistItem[]>('/watchlist');

export const addToWatchlist = (assetSymbol: string) =>
  requestWithAuth<WatchlistItem[]>('/watchlist', { method: 'POST', body: JSON.stringify({ assetSymbol }) });

export const removeFromWatchlist = (assetSymbol: string) =>
  requestWithAuth<WatchlistItem[]>(`/watchlist/${assetSymbol}`, { method: 'DELETE' });

// Los avisos traen rutas de la web; acá se traducen a pantallas de la app.
export function notificationRoute(link: string | null): Href | null {
  switch (link) {
    case '/dashboard':
      return '/';
    case '/goals':
    case '/strategy':
    case '/market':
    case '/alerts':
    case '/watchlist':
      return link;
    default:
      return null;
  }
}
