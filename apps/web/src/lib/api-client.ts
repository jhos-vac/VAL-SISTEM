// Cliente HTTP hacia el backend (VAL-BACKEND / NestJS). Ningún cliente
// (web o móvil) habla directo con Binance ni con las bases de datos —
// siempre a través de esta API (ver Especificacion_Web_Movil_MVP.md, §5).
//
// El backend hoy solo expone el módulo Identity & Auth (ver
// Estado_Backend_VAL-BACKEND.md) — los endpoints de Market/Portfolio/
// Automation siguen sin construir, así que esas pantallas se quedan con
// mock-data.ts hasta que existan de verdad.

// Sin barra final: NEXT_PUBLIC_API_URL a veces queda pegado con un "/"
// al final (typo al configurarlo en Vercel/Render) y, como abajo se arma
// la URL con `${API_BASE_URL}${path}` y los paths ya empiezan con "/",
// eso generaba peticiones con doble barra (.../com//auth/login) que el
// backend no reconoce y devuelve 404.
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string | null;
}

export async function request<T>(
  path: string,
  { accessToken, headers, ...init }: RequestOptions = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // El refresh token vive en cookie httpOnly (RNFC-01); el access token
    // se pasa explícitamente porque solo vive en memoria del cliente.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(
      (body as { message?: string })?.message ?? `Error ${res.status}`,
      res.status,
      body
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Endpoints planeados (Especificacion_Web_Movil_MVP.md §10) ---
// Comentados hasta que existan en el backend; sirven de referencia del
// contrato esperado por la UI. Auth ya está implementado — ver
// lib/auth-client.ts.
//
// GET  /portfolios
// POST /portfolios                { name, baseCurrency }
// GET  /portfolios/:id/summary
// GET  /portfolios/:id/allocation
// GET  /portfolios/:id/performance?range=30d
//
// GET  /exchange-accounts
// POST /exchange-accounts         { exchange, apiKey, apiSecret, label }
// GET  /exchange-accounts/:id/sync-history
//
// GET  /positions?portfolioId=
// GET  /transactions?portfolioId=&type=&assetSymbol=&from=&to=
// POST /transactions              (alta manual, RFW-08)
//
// GET  /market/tickers?symbols=
