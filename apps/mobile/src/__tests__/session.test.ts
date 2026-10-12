import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  bootstrapSession,
  login,
  logout,
  refreshSession,
  requestWithAuth,
} from '@/lib/session';

// jest.mock se eleva por encima de los imports: session.ts ya recibe los
// dobles de abajo.

// Dobles de la red y del almacenamiento seguro.
const mockRequest = jest.fn();
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, request: (...args: unknown[]) => mockRequest(...args) };
});

const store: Record<string, string | null> = {};
jest.mock('@/lib/secure', () => ({
  secure: {
    getRefreshToken: jest.fn(async () => store.refresh ?? null),
    setRefreshToken: jest.fn(async (t: string) => {
      store.refresh = t;
    }),
    clearRefreshToken: jest.fn(async () => {
      store.refresh = null;
    }),
    getBiometricEnabled: jest.fn(async () => store.biometric === 'true'),
    getDeviceId: jest.fn(async () => store.deviceId ?? null),
    clearDeviceId: jest.fn(async () => {
      store.deviceId = null;
    }),
  },
}));

jest.mock('@/lib/query', () => ({
  queryClient: { clear: jest.fn() },
  queryPersister: { removeClient: jest.fn(async () => undefined) },
}));


const user = { id: 'u-1', email: 'a@b.c' };
const session = (n: number) => ({ user, accessToken: `access-${n}`, refreshToken: `refresh-${n}` });

beforeEach(() => {
  jest.useFakeTimers();
  mockRequest.mockReset();
  for (const k of Object.keys(store)) delete store[k];
  useAuthStore.setState({ user: null, accessToken: null, status: 'idle' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('login', () => {
  it('guarda el refresh token y deja la sesión activa', async () => {
    mockRequest.mockResolvedValueOnce(session(1));
    await login({ email: 'a@b.c', password: 'x' });
    expect(store.refresh).toBe('refresh-1');
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'access-1' });
  });
});

describe('refreshSession', () => {
  it('sin refresh token guardado no hay sesión', async () => {
    await expect(refreshSession()).resolves.toBe('no-session');
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('rota el token: guarda el nuevo refresh token', async () => {
    store.refresh = 'refresh-1';
    mockRequest.mockResolvedValueOnce(session(2));
    await expect(refreshSession()).resolves.toBe('refreshed');
    expect(mockRequest).toHaveBeenCalledWith(
      '/auth/refresh',
      expect.objectContaining({ body: JSON.stringify({ refreshToken: 'refresh-1' }) }),
    );
    expect(store.refresh).toBe('refresh-2');
  });

  it('llamadas en paralelo comparten una sola renovación', async () => {
    store.refresh = 'refresh-1';
    mockRequest.mockResolvedValueOnce(session(2));
    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(results).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('token revocado (401): borra la sesión guardada', async () => {
    store.refresh = 'refresh-1';
    mockRequest.mockRejectedValueOnce(new ApiError('Refresh inválido', 401));
    await expect(refreshSession()).resolves.toBe('no-session');
    expect(store.refresh).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('sin red: reintenta y conserva el refresh token', async () => {
    store.refresh = 'refresh-1';
    mockRequest.mockRejectedValue(new ApiError('offline', 0));
    const promise = refreshSession();
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('offline');
    expect(mockRequest).toHaveBeenCalledTimes(3);
    expect(store.refresh).toBe('refresh-1');
  });
});

describe('bootstrapSession', () => {
  it('con biometría activada deja la sesión bloqueada sin tocar la red', async () => {
    store.refresh = 'refresh-1';
    store.biometric = 'true';
    await bootstrapSession();
    expect(useAuthStore.getState().status).toBe('locked');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('sin red entra en modo offline en vez de mandar al login', async () => {
    store.refresh = 'refresh-1';
    mockRequest.mockRejectedValue(new ApiError('offline', 0));
    const promise = bootstrapSession();
    await jest.runAllTimersAsync();
    await promise;
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: null });
  });
});

describe('requestWithAuth', () => {
  it('ante un 401 renueva una vez y reintenta con el token nuevo', async () => {
    store.refresh = 'refresh-1';
    useAuthStore.setState({ accessToken: 'access-1', status: 'authenticated' });
    mockRequest
      .mockRejectedValueOnce(new ApiError('expirado', 401))
      .mockResolvedValueOnce(session(2))
      .mockResolvedValueOnce({ ok: true });
    await expect(requestWithAuth('/portfolios')).resolves.toEqual({ ok: true });
    expect(mockRequest).toHaveBeenLastCalledWith('/portfolios', expect.objectContaining({ accessToken: 'access-2' }));
  });
});

describe('logout', () => {
  it('limpia la sesión local aunque el backend no responda', async () => {
    store.refresh = 'refresh-1';
    store.deviceId = 'd-1';
    useAuthStore.setState({ accessToken: 'access-1', status: 'authenticated' });
    mockRequest.mockRejectedValue(new ApiError('offline', 0));
    await logout();
    expect(store.refresh).toBeNull();
    expect(store.deviceId).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
