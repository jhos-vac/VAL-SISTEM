// Cliente HTTP hacia el backend (VAL-BACKEND / NestJS). Ningún cliente
// (web o móvil) habla directo con Binance ni con las bases de datos —
// siempre a través de esta API (ver Especificacion_Web_Movil_MVP.md, §5).
//
// El backend hoy solo expone el módulo Identity & Auth (ver
// Estado_Backend_VAL-BACKEND.md) — los endpoints de Market/Portfolio/
// Automation siguen sin construir, así que esas pantallas se quedan con
// mock-data.ts hasta que existan de verdad.

// Todas las llamadas van a /backend-api/* (mismo dominio que la web); el
// servidor de Next las reenvía al backend real — ver `rewrites` en
// next.config.ts. Esto mantiene la cookie de sesión como cookie de primera
// parte; llamando directo al dominio del backend, el navegador no la
// enviaba y cada recarga de página mandaba al login.
const API_BASE_URL = "/backend-api";

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
