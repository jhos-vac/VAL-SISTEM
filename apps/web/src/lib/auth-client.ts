// Funciones de alto nivel para el módulo Identity & Auth de VAL-BACKEND —
// centralizan el contrato exacto de cada endpoint (ver
// VAL-BACKEND/src/auth/auth.controller.ts) para que las pantallas no
// arme cada fetch a mano. Todas usan `request()` de api-client.ts.

import { request, ApiError } from "./api-client";
import { useAuthStore } from "@/store/auth-store";
import type { AuthTokens, User } from "@val-sistem/shared";

type SessionResponse = { user: User } & AuthTokens;

export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<SessionResponse> {
  const session = await request<SessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  useAuthStore.getState().setSession(session.user, session.accessToken);
  return session;
}

export async function forgotPassword(email: string): Promise<void> {
  await request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  await request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Intenta recuperar la sesión usando el refresh token que vive en la
// cookie httpOnly (RNFC-01). Se llama al montar la app (ver
// session-bootstrap.tsx) y también como reintento automático cuando una
// llamada autenticada devuelve 401 (ver requestWithAuth más abajo). Si no
// hay cookie válida, simplemente deja la sesión en "unauthenticated" —
// no es un error, es el estado normal de un visitante sin sesión.
const REFRESH_MAX_ATTEMPTS = 4;
const REFRESH_RETRY_DELAY_MS = 4000;

export async function refreshSession(): Promise<string | null> {
  for (let attempt = 1; attempt <= REFRESH_MAX_ATTEMPTS; attempt++) {
    try {
      const session = await request<SessionResponse>("/auth/refresh", {
        method: "POST",
      });
      useAuthStore.getState().setSession(session.user, session.accessToken);
      return session.accessToken;
    } catch (err) {
      // Un 4xx (sin cookie, token vencido o revocado) es definitivo: no hay
      // sesión que recuperar. Un fallo de red o un 5xx/504 suele ser el
      // backend gratuito de Render despertando (tarda hasta ~1 min tras
      // estar inactivo): se reintenta en vez de mandar al login.
      const definitive = err instanceof ApiError && err.status >= 400 && err.status < 500;
      if (definitive || attempt === REFRESH_MAX_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAY_MS));
    }
  }
  useAuthStore.getState().clearSession();
  return null;
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    // Limpiar la sesión local siempre, incluso si la llamada falla (p.ej.
    // el backend ya no está corriendo) — no tiene sentido dejar al
    // usuario "atrapado" en una sesión que el cliente ya no puede usar.
    useAuthStore.getState().clearSession();
  }
}

// Wrapper para llamadas que requieren sesión: adjunta el access token
// actual y, si el backend responde 401 (access token expirado), intenta
// un refresh silencioso y reintenta una sola vez antes de rendirse.
export async function requestWithAuth<T>(
  path: string,
  init: Omit<Parameters<typeof request>[1], "accessToken"> = {}
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  try {
    return await request<T>(path, { ...init, accessToken: token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return request<T>(path, { ...init, accessToken: refreshed });
      }
    }
    throw err;
  }
}

export async function fetchProfile(): Promise<User> {
  return requestWithAuth<User>("/auth/me");
}
