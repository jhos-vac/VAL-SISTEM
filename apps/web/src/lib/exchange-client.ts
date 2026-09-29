// Cliente del módulo Exchange/Sync del backend (conexión de cuentas de
// Binance) — ver src/exchange/ en VAL-BACKEND. Todos los endpoints
// requieren sesión, así que todo pasa por requestWithAuth().
import { requestWithAuth } from "./auth-client";
import type { ExchangeAccount } from "@val-sistem/shared";

export interface ConnectExchangeAccountInput {
  label: string;
  apiKey: string;
  apiSecret: string;
  isTestnet?: boolean;
}

// Respuesta de POST /exchange-accounts — extiende ExchangeAccount con
// info puntual de esa conexión (aviso de seguridad si la key tiene más
// permisos de los necesarios, y el resultado del primer sync).
export interface ConnectExchangeAccountResponse extends ExchangeAccount {
  warning?: string;
  syncMessage: string;
}

export interface SyncResult {
  status: "completed" | "failed";
  recordsProcessed: number;
  message: string;
}

export async function fetchExchangeAccounts(): Promise<ExchangeAccount[]> {
  return requestWithAuth<ExchangeAccount[]>("/exchange-accounts");
}

export async function connectExchangeAccount(
  input: ConnectExchangeAccountInput,
): Promise<ConnectExchangeAccountResponse> {
  return requestWithAuth<ConnectExchangeAccountResponse>("/exchange-accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function syncExchangeAccount(id: string): Promise<SyncResult> {
  return requestWithAuth<SyncResult>(`/exchange-accounts/${id}/sync`, {
    method: "POST",
  });
}

export async function disconnectExchangeAccount(id: string): Promise<void> {
  await requestWithAuth<{ success: boolean }>(`/exchange-accounts/${id}`, {
    method: "DELETE",
  });
}
