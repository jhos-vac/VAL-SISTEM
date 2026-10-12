// Cliente HTTP hacia el backend. Igual que la web: ningún cliente habla
// directo con Binance ni con las bases de datos.
import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    // 0 = no hubo respuesta (sin conexión, timeout, backend dormido).
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export interface RequestOptions extends RequestInit {
  accessToken?: string | null;
  timeoutMs?: number;
}

// El backend de Render (plan gratuito) puede tardar ~1 min en despertar;
// el timeout es generoso para no cortar ese primer request.
const DEFAULT_TIMEOUT_MS = 70_000;

export async function request<T>(
  path: string,
  { accessToken, headers, timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // El backend devuelve el refresh token en el body solo a clientes
        // móviles (ver AuthController.deliverRefreshToken).
        'X-Client-Type': 'mobile',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => undefined);
    const message = (body as { message?: string | string[] } | undefined)?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join('. ') : (message ?? `Error ${res.status}`),
      res.status,
      body,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
