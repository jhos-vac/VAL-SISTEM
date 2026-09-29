// RNFC-01: el access token vive SOLO en memoria (nunca localStorage). Este
// store se reinicia al recargar la página; el refresh token (cookie
// httpOnly) es lo que permite recuperar la sesión sin pedir login de nuevo,
// vía POST /auth/refresh al montar la app.
import { create } from "zustand";
import type { User } from "@val-sistem/shared";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: "idle" | "authenticated" | "unauthenticated";
  setSession: (user: User, accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setSession: (user, accessToken) =>
    set({ user, accessToken, status: "authenticated" }),
  clearSession: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
}));
