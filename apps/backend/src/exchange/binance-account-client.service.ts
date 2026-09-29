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
}
