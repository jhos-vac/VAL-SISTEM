// Ciclo de vida de la sesión en el teléfono: login, arranque (con o sin
// biometría), renovación del access token y logout.
import type { User } from '@val-sistem/shared';
import { ApiError, request, type RequestOptions } from './api';
import { secure } from './secure';
import { queryClient, queryPersister } from './query';
import { useAuthStore } from '../store/auth';

interface SessionResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

async function storeSession(session: SessionResponse): Promise<void> {
  await secure.setRefreshToken(session.refreshToken);
  useAuthStore.getState().setSession(session.user, session.accessToken);
}

export async function login(input: LoginInput): Promise<User> {
  const session = await request<SessionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  await storeSession(session);
  return session.user;
}

export function register(input: RegisterInput): Promise<User> {
  return request<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export type RefreshOutcome = 'refreshed' | 'no-session' | 'offline';

const REFRESH_MAX_ATTEMPTS = 3;
const REFRESH_RETRY_DELAY_MS = 3000;

let inFlight: Promise<RefreshOutcome> | null = null;

// El backend rota el refresh token en cada uso: dos renovaciones en
// paralelo con el mismo token harían fallar la segunda. Por eso hay una
// sola en vuelo a la vez y todas las llamadas esperan esa misma.
export function refreshSession(): Promise<RefreshOutcome> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<RefreshOutcome> {
  const refreshToken = await secure.getRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().clearSession();
    return 'no-session';
  }

  for (let attempt = 1; attempt <= REFRESH_MAX_ATTEMPTS; attempt++) {
    try {
      const session = await request<SessionResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      await storeSession(session);
      return 'refreshed';
    } catch (err) {
      // 4xx = token vencido o revocado: no hay sesión que recuperar.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        await secure.clearRefreshToken();
        useAuthStore.getState().clearSession();
        return 'no-session';
      }
      // Sin red o 5xx (Render despertando): se reintenta.
      if (attempt < REFRESH_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
      }
    }
  }
  // Se conserva el refresh token: se vuelve a intentar al recuperar la red.
  return 'offline';
}

// Arranque de la app. Con biometría activada, la sesión guardada queda
// bloqueada hasta que el usuario se autentique (ver app/lock.tsx).
export async function bootstrapSession(): Promise<void> {
  const refreshToken = await secure.getRefreshToken();
  if (!refreshToken) {
    useAuthStore.getState().clearSession();
    return;
  }
  if (await secure.getBiometricEnabled()) {
    useAuthStore.getState().setLocked();
    return;
  }
  await resumeSession();
}

// Renueva la sesión guardada. Sin conexión se entra igual en modo
// offline (datos en caché) en lugar de mandar al login.
export async function resumeSession(): Promise<void> {
  const outcome = await refreshSession();
  if (outcome === 'offline') useAuthStore.getState().setOfflineSession();
}

export async function logout(): Promise<void> {
  const refreshToken = await secure.getRefreshToken();
  const deviceId = await secure.getDeviceId();
  const accessToken = useAuthStore.getState().accessToken;
  try {
    if (deviceId && accessToken) {
      await request(`/devices/${deviceId}`, { method: 'DELETE', accessToken });
    }
    if (refreshToken) {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Sin red o backend caído: igual se cierra la sesión local.
  } finally {
    await clearLocalSession();
  }
}

// Borra todo rastro de la sesión en el teléfono: tokens, id del
// dispositivo y la caché con los datos del usuario.
export async function clearLocalSession(): Promise<void> {
  await secure.clearRefreshToken();
  await secure.clearDeviceId();
  queryClient.clear();
  await queryPersister.removeClient();
  useAuthStore.getState().clearSession();
}

// Borra la cuenta y todos sus datos en el backend (irreversible). El
// backend ya revoca las sesiones y da de baja los dispositivos; acá solo
// queda limpiar lo local.
export async function deleteAccount(password: string): Promise<void> {
  await requestWithAuth('/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
  await clearLocalSession();
}

// Llamadas que requieren sesión: si no hay access token (arranque offline)
// o el backend responde 401, renueva una vez y reintenta.
export async function requestWithAuth<T>(
  path: string,
  init: Omit<RequestOptions, 'accessToken'> = {},
): Promise<T> {
  let token = useAuthStore.getState().accessToken;
  if (!token) {
    await refreshSession();
    token = useAuthStore.getState().accessToken;
    if (!token) throw new ApiError('Sin sesión activa', 401);
  }
  try {
    return await request<T>(path, { ...init, accessToken: token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const outcome = await refreshSession();
      const refreshed = useAuthStore.getState().accessToken;
      if (outcome === 'refreshed' && refreshed) {
        return request<T>(path, { ...init, accessToken: refreshed });
      }
    }
    throw err;
  }
}
