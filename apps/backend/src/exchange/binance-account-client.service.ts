import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

const MAINNET_BASE_URL = 'https://api.binance.com';
const TESTNET_BASE_URL = 'https://testnet.binance.vision';
const MARKET_DATA_BASE_URL = 'https://data-api.binance.vision';
const DAY_MS = 86_400_000;
// Monedas que valen ~1 USD: una conversión desde ellas ya trae el precio.
const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'TUSD', 'DAI']);
const USD_LIKE = new Set(['USD', ...STABLES]);

export interface BinanceAccountSnapshot {
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{ asset: string; total: number }>;
}

export interface BinanceTrade {
  orderId: number;
  price: number;
  qty: number;
  quoteQty: number;
  commission: number;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
}

// Binance bloqueó las consultas de esta IP (HTTP 418/429) hasta `until`.
// Mientras dure, no se le vuelve a pegar: insistir alarga el bloqueo.
export class BinanceRateLimitError extends Error {
  constructor(readonly until: number) {
    const minutes = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
    super(
      `Binance limitó temporalmente las consultas del servidor. Se reintenta solo en unos ${minutes} min.`,
    );
  }
}

// Falla de Binance que no tiene que ver con permisos (servidor caído, red):
// el sync se aborta para no guardar precios incompletos.
export class BinanceTransientError extends Error {}

// Cliente mínimo para los endpoints *firmados* de Binance (requieren API
// key + secret) — distinto de BinanceTickerSyncService (market/), que
// solo pega contra el endpoint público de precios y no firma nada.
@Injectable()
export class BinanceAccountClientService {
  private bannedUntil = 0;

  private sign(query: string, apiSecret: string): string {
    return createHmac('sha256', apiSecret).update(query).digest('hex');
  }

  isRateLimited(): boolean {
    return Date.now() < this.bannedUntil;
  }

  private guard(): void {
    if (this.isRateLimited()) throw new BinanceRateLimitError(this.bannedUntil);
  }

  // 418/429: guarda hasta cuándo dura el bloqueo y corta. 5xx: transitorio.
  private async checkLimits(res: Response): Promise<void> {
    if (res.status === 418 || res.status === 429) {
      const body = await res.text().catch(() => '');
      const fromBody = /banned until (\d+)/.exec(body)?.[1];
      const retryAfter = Number(res.headers.get('retry-after'));
      this.bannedUntil = fromBody
        ? Number(fromBody)
        : Date.now() + (retryAfter > 0 ? retryAfter * 1000 : 60_000);
      throw new BinanceRateLimitError(this.bannedUntil);
    }
    if (res.status >= 500) {
      throw new BinanceTransientError(`Binance respondió ${res.status}`);
    }
  }

  private async fetchOrTransient(
    url: string,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err) {
      throw new BinanceTransientError(
        `No se pudo conectar con Binance: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Prueba la API key contra /api/v3/account (requiere el permiso
  // "Enable Reading") y devuelve balances + permisos de la key. Tira un
  // Error con el motivo si Binance la rechaza — el caller decide cómo
  // traducirlo a una respuesta HTTP.
  async getAccountSnapshot(
    apiKey: string,
    apiSecret: string,
    isTestnet = false,
  ): Promise<BinanceAccountSnapshot> {
    this.guard();
    const baseUrl = isTestnet ? TESTNET_BASE_URL : MAINNET_BASE_URL;
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}&recvWindow=5000`;
    const signature = this.sign(query, apiSecret);

    const res = await this.fetchOrTransient(
      `${baseUrl}/api/v3/account?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      },
    );

    if (!res.ok) {
      await this.checkLimits(res);
      const body = await res.text().catch(() => '');
      let reason = body;
      try {
        const parsed = JSON.parse(body) as { msg?: string };
        if (parsed.msg) reason = parsed.msg;
      } catch {
        // La respuesta no era JSON — se usa el texto crudo tal cual.
      }
      throw new Error(
        `Binance respondió ${res.status}: ${reason || 'sin detalle'}`,
      );
    }

    const data = (await res.json()) as {
      canTrade?: boolean;
      canWithdraw?: boolean;
      canDeposit?: boolean;
      balances?: Array<{ asset: string; free: string; locked: string }>;
    };

    const balances = (data.balances ?? [])
      .map((b) => ({
        asset: b.asset,
        total: Number(b.free) + Number(b.locked),
      }))
      .filter((b) => b.total > 0);

    return {
      canTrade: Boolean(data.canTrade),
      canWithdraw: Boolean(data.canWithdraw),
      canDeposit: Boolean(data.canDeposit),
      balances,
    };
  }

  // Historial de operaciones de un símbolo puntual (p.ej. BTCUSDT) para
  // calcular costo base real (ver BinanceAccountSyncService). A
  // diferencia de getAccountSnapshot, un fallo acá NO rompe el sync
  // completo si Binance contesta que el par no aplica: se trata como "sin
  // historial para este símbolo" (devuelve []). Pero si Binance está caído o
  // limitó las consultas, se corta el sync: tratarlo como "sin historial"
  // fijaría un precio de compra equivocado.
  async getMyTrades(
    apiKey: string,
    apiSecret: string,
    symbol: string,
    isTestnet = false,
  ): Promise<BinanceTrade[]> {
    this.guard();
    const baseUrl = isTestnet ? TESTNET_BASE_URL : MAINNET_BASE_URL;
    const timestamp = Date.now();
    const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=5000`;
    const signature = this.sign(query, apiSecret);

    const res = await this.fetchOrTransient(
      `${baseUrl}/api/v3/myTrades?${query}&signature=${signature}`,
      { headers: { 'X-MBX-APIKEY': apiKey } },
    );
    if (!res.ok) {
      await this.checkLimits(res);
      return [];
    }
    const data = (await res.json()) as Array<{
      orderId: number;
      price: string;
      qty: string;
      quoteQty: string;
      commission: string;
      commissionAsset: string;
      time: number;
      isBuyer: boolean;
    }>;

    return data
      .map((t) => ({
        orderId: t.orderId,
        price: Number(t.price),
        qty: Number(t.qty),
        quoteQty: Number(t.quoteQty),
        commission: Number(t.commission),
        commissionAsset: t.commissionAsset,
        time: t.time,
        isBuyer: t.isBuyer,
      }))
      .sort((a, b) => a.time - b.time);
  }

  // Llamada firmada genérica para los endpoints /sapi de Binance (fondos,
  // Simple Earn). Tira un Error con el motivo si Binance la rechaza.
  private async signedSapi<T>(
    method: 'GET' | 'POST',
    path: string,
    params: Record<string, string | number>,
    apiKey: string,
    apiSecret: string,
  ): Promise<T> {
    this.guard();
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      timestamp: String(Date.now()),
      recvWindow: '5000',
    }).toString();
    const signature = this.sign(query, apiSecret);

    const res = await this.fetchOrTransient(
      `${MAINNET_BASE_URL}${path}?${query}&signature=${signature}`,
      { method, headers: { 'X-MBX-APIKEY': apiKey } },
    );
    if (!res.ok) {
      await this.checkLimits(res);
      const body = await res.text().catch(() => '');
      throw new Error(`Binance respondió ${res.status} en ${path}: ${body}`);
    }
    return (await res.json()) as T;
  }

  // Billetera de Fondos (Funding) — la que usa P2P, pagos y las
  // transferencias desde otras apps. NO aparece en /api/v3/account.
  // Devuelve null si no se pudo leer (testnet no la tiene, o la API key no
  // tiene permiso): el sync sigue sin ella en vez de fallar completo.
  async getFundingBalances(
    apiKey: string,
    apiSecret: string,
    isTestnet = false,
  ): Promise<Array<{ asset: string; total: number }> | null> {
    if (isTestnet) return null;
    try {
      const rows = await this.signedSapi<
        Array<{
          asset: string;
          free: string;
          locked: string;
          freeze: string;
        }>
      >('POST', '/sapi/v1/asset/get-funding-asset', {}, apiKey, apiSecret);
      return rows
        .map((r) => ({
          asset: r.asset,
          total: Number(r.free) + Number(r.locked) + Number(r.freeze),
        }))
        .filter((b) => b.total > 0);
    } catch (err) {
      if (err instanceof BinanceRateLimitError) throw err;
      return null;
    }
  }

  // Simple Earn completo: ahorro flexible + productos con plazo fijo
  // (Locked). /api/v3/account solo muestra el flexible (como monedas
  // "LD…") y nada del plazo fijo, por eso el total de Earn no coincidía
  // con el de la app de Binance. Devuelve null si el flexible no se pudo
  // leer (el sync cae al método anterior basado en las monedas LD); si solo
  // falla el plazo fijo, se devuelve el flexible igual.
  async getEarnBalances(
    apiKey: string,
    apiSecret: string,
    isTestnet = false,
  ): Promise<Array<{ asset: string; total: number }> | null> {
    if (isTestnet) return null;

    const totals = new Map<string, number>();
    const add = (asset: string, amount: number) => {
      if (amount > 0) totals.set(asset, (totals.get(asset) ?? 0) + amount);
    };

    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;

    const fetchAll = async <R>(path: string): Promise<R[]> => {
      const all: R[] = [];
      for (let current = 1; current <= MAX_PAGES; current++) {
        const page = await this.signedSapi<{ rows?: R[]; total?: number }>(
          'GET',
          path,
          { current, size: PAGE_SIZE },
          apiKey,
          apiSecret,
        );
        const rows = page.rows ?? [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE || all.length >= (page.total ?? 0)) break;
      }
      return all;
    };

    try {
      const flexible = await fetchAll<{ asset: string; totalAmount: string }>(
        '/sapi/v1/simple-earn/flexible/position',
      );
      for (const r of flexible) add(r.asset, Number(r.totalAmount));
    } catch (err) {
      if (err instanceof BinanceRateLimitError) throw err;
      return null;
    }

    try {
      const locked = await fetchAll<{ asset: string; amount: string }>(
        '/sapi/v1/simple-earn/locked/position',
      );
      for (const r of locked) add(r.asset, Number(r.amount));
    } catch {
      // Sin plazo fijo (o sin permiso para leerlo): se sigue con el flexible.
    }

    return [...totals].map(([asset, total]) => ({ asset, total }));
  }

  // --- Entradas de monedas sin trade (para fijar su precio de compra) ---
  // Si la key no tiene permiso para una fuente, esa fuente se omite. Si
  // Binance está caído o limitó las consultas, el error sube y el sync se
  // corta: guardar un precio con datos incompletos lo dejaría fijo mal.

  // Depósitos acreditados (status=1). Binance acepta ventanas de 90 días.
  async getDeposits(
    apiKey: string,
    apiSecret: string,
    since: number,
    until = Date.now(),
  ): Promise<AcquisitionRecord[]> {
    const WINDOW = 89 * DAY_MS;
    const out: AcquisitionRecord[] = [];
    for (let start = since; start < until; start += WINDOW) {
      try {
        const rows = await this.signedSapi<
          Array<{
            coin: string;
            amount: string;
            insertTime: number;
            status: number;
          }>
        >(
          'GET',
          '/sapi/v1/capital/deposit/hisrec',
          {
            status: 1,
            startTime: start,
            endTime: Math.min(start + WINDOW, until),
            limit: 1000,
          },
          apiKey,
          apiSecret,
        );
        for (const r of rows) {
          out.push({
            asset: r.coin,
            quantity: Number(r.amount),
            time: r.insertTime,
            price: null,
          });
        }
      } catch (err) {
        if (isRetryable(err)) throw err;
        return out;
      }
    }
    return out;
  }

  // Conversiones (Convertir). Ventanas de 30 días. Si se pagó con USDT el
  // precio sale directo de la conversión.
  async getConvertTrades(
    apiKey: string,
    apiSecret: string,
    since: number,
    until = Date.now(),
  ): Promise<AcquisitionRecord[]> {
    const WINDOW = 29 * DAY_MS;
    const out: AcquisitionRecord[] = [];
    for (let start = since; start < until; start += WINDOW) {
      try {
        const page = await this.signedSapi<{
          list?: Array<{
            fromAsset: string;
            fromAmount: string;
            toAsset: string;
            toAmount: string;
            createTime: number;
            orderStatus: string;
          }>;
        }>(
          'GET',
          '/sapi/v1/convert/tradeFlow',
          {
            startTime: start,
            endTime: Math.min(start + WINDOW, until),
            limit: 1000,
          },
          apiKey,
          apiSecret,
        );
        for (const r of page.list ?? []) {
          if (r.orderStatus !== 'SUCCESS') continue;
          const toAmount = Number(r.toAmount);
          out.push({
            asset: r.toAsset,
            quantity: toAmount,
            time: r.createTime,
            price:
              STABLES.has(r.fromAsset) && toAmount > 0
                ? Number(r.fromAmount) / toAmount
                : null,
          });
        }
      } catch (err) {
        if (isRetryable(err)) throw err;
        return out;
      }
    }
    return out;
  }

  // Compras con tarjeta o transferencia bancaria (Comprar cripto).
  async getFiatBuys(
    apiKey: string,
    apiSecret: string,
    since: number,
    until = Date.now(),
  ): Promise<AcquisitionRecord[]> {
    try {
      const page = await this.signedSapi<{
        data?: Array<{
          cryptoCurrency: string;
          obtainAmount: string;
          fiatCurrency: string;
          price: string;
          status: string;
          createTime: number;
        }>;
      }>(
        'GET',
        '/sapi/v1/fiat/payments',
        { transactionType: 0, beginTime: since, endTime: until, rows: 500 },
        apiKey,
        apiSecret,
      );
      return (page.data ?? [])
        .filter((r) => r.status === 'Completed')
        .map((r) => ({
          asset: r.cryptoCurrency,
          quantity: Number(r.obtainAmount),
          time: r.createTime,
          price: USD_LIKE.has(r.fiatCurrency) ? Number(r.price) : null,
        }));
    } catch (err) {
      if (isRetryable(err)) throw err;
      return [];
    }
  }

  // Precio contra USDT en un momento dado (vela de 1 minuto, endpoint
  // público; primero el espejo de datos de mercado, que tiene sus propios
  // límites). null si la moneda no tiene par contra USDT; si Binance está
  // caído o limitado, tira el error (no se fija un precio sin dato).
  async getPriceAt(symbol: string, time: number): Promise<number | null> {
    const path = `/api/v3/klines?symbol=${symbol}USDT&interval=1m&startTime=${time}&limit=1`;
    let lastError: unknown = null;
    for (const base of [MARKET_DATA_BASE_URL, MAINNET_BASE_URL]) {
      try {
        const res = await this.fetchOrTransient(`${base}${path}`);
        if (!res.ok) {
          // Un límite del espejo público no bloquea la API privada.
          if (base === MARKET_DATA_BASE_URL && res.status >= 418) {
            lastError = new BinanceTransientError(
              `Binance respondió ${res.status}`,
            );
            continue;
          }
          await this.checkLimits(res);
          return null; // 400: sin par contra USDT.
        }
        const rows = (await res.json()) as Array<[number, string]>;
        const open = rows[0] ? Number(rows[0][1]) : NaN;
        return Number.isFinite(open) && open > 0 ? open : null;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }
}

export interface AcquisitionRecord {
  asset: string;
  quantity: number;
  time: number;
  // Precio en USDT si la transacción lo trae; si no, se busca por fecha.
  price: number | null;
}

function isRetryable(err: unknown): boolean {
  return (
    err instanceof BinanceRateLimitError || err instanceof BinanceTransientError
  );
}
