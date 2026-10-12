// El access token vive solo en memoria (igual que en la web, RNFC-01);
// el refresh token, en SecureStore (ver lib/secure.ts).
import { create } from 'zustand';
import type { User } from '@val-sistem/shared';

export type AuthStatus =
  | 'idle' // arrancando: todavía no se sabe si hay sesión
  | 'locked' // hay sesión guardada pero falta desbloquear con biometría
  | 'authenticated'
  | 'unauthenticated';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
  setSession: (user: User, accessToken: string) => void;
  // Sesión guardada pero sin poder renovarla ahora (sin conexión): se
  // entra igual y se muestran los datos en caché.
  setOfflineSession: () => void;
  setLocked: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'idle',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setOfflineSession: () => set({ accessToken: null, status: 'authenticated' }),
  setLocked: () => set({ accessToken: null, status: 'locked' }),
  clearSession: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));
