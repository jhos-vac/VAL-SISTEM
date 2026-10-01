import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

const MAINNET_BASE_URL = 'https://api.binance.com';
const TESTNET_BASE_URL = 'https://testnet.binance.vision';

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

// Cliente mínimo para los endpoints *firmados* de Binance (requieren API
// key + secret) — distinto de BinanceTickerSyncService (market/), que
// solo pega contra el endpoint público de precios y no firma nada.
@Injectable()
export class BinanceAccountClientService {
  private sign(query: string, apiSecret: string): string {
    return createHmac('sha256', apiSecret).update(query).digest('hex');
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
    const baseUrl = isTestnet ? TESTNET_BASE_URL : MAINNET_BASE_URL;
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}&recvWindow=5000`;
    const signature = this.sign(query, apiSecret);

    const res = await fetch(
      `${baseUrl}/api/v3/account?${query}&signature=${signature}`,
      {
        headers: { 'X-MBX-APIKEY': apiKey },
      },
    );

    if (!res.ok) {
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
  // completo — se trata como "sin historial para este símbolo" (devuelve
  // []), porque puede pasar por motivos normales (el usuario nunca operó
  // ese par en Binance, solo depositó el activo) y no tiene sentido
  // tumbar la sincronización de los demás activos por eso.
  async getMyTrades(
    apiKey: string,
    apiSecret: string,
    symbol: string,
    isTestnet = false,
  ): Promise<BinanceTrade[]> {
    const baseUrl = isTestnet ? TESTNET_BASE_URL : MAINNET_BASE_URL;
    const timestamp = Date.now();
    const query = `symbol=${symbol}&timestamp=${timestamp}&recvWindow=5000`;
    const signature = this.sign(query, apiSecret);

    try {
      const res = await fetch(
        `${baseUrl}/api/v3/myTrades?${query}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': apiKey } },
      );
      if (!res.ok) return [];

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
    } catch {
      return [];
    }
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
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      timestamp: String(Date.now()),
      recvWindow: '5000',
    }).toString();
    const signature = this.sign(query, apiSecret);

    const res = await fetch(
      `${MAINNET_BASE_URL}${path}?${query}&signature=${signature}`,
      { method, headers: { 'X-MBX-APIKEY': apiKey } },
    );
    if (!res.ok) {
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
    } catch {
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
    } catch {
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
}
