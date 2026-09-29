"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatQuantity } from "@val-sistem/shared";
import type { TransactionType } from "@val-sistem/shared";
import { fetchTransactions } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

const TYPE_LABEL: Record<string, string> = {
  buy: "Compra",
  sell: "Venta",
  transfer_in: "Transferencia entrante",
  transfer_out: "Transferencia saliente",
};

const TYPE_COLOR: Record<string, string> = {
  buy: "text-status-good",
  sell: "text-status-critical",
  transfer_in: "text-primary",
  transfer_out: "text-text-secondary",
};

// RFW-07: historial de transacciones con filtros (tipo, activo, rango de
// fechas) — ya habla con GET /transactions?portfolioId=&type=&assetSymbol=&from=&to=.
export default function TransactionsPage() {
  const { portfolio, hasNone, isLoading: loadingPortfolio } = useDefaultPortfolio();
  const [type, setType] = useState("");
  const [assetSymbol, setAssetSymbol] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", portfolio?.id, type, assetSymbol, from, to],
    queryFn: () =>
      fetchTransactions({
        portfolioId: portfolio!.id,
        type: (type || undefined) as TransactionType | undefined,
        assetSymbol: assetSymbol || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: !!portfolio,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Transacciones</h1>
        <Link
          href="/transactions/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Registrar operación
        </Link>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-2 py-1"
          >
            <option value="">Todos los tipos</option>
            <option value="buy">Compra</option>
            <option value="sell">Venta</option>
            <option value="transfer_in">Transferencia entrante</option>
            <option value="transfer_out">Transferencia saliente</option>
          </select>
          <input
            value={assetSymbol}
            onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())}
            placeholder="Activo (BTC, ETH…)"
            className="w-40 rounded-md border border-border-hairline bg-background px-2 py-1"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-2 py-1"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-2 py-1"
          />
        </div>

        {loadingPortfolio || isLoading ? (
          <p className="py-4 text-sm text-text-secondary">Cargando…</p>
        ) : hasNone ? (
          <p className="py-4 text-sm text-text-secondary">
            Todavía no tenés portafolios.{" "}
            <Link href="/portfolios" className="text-primary">
              Creá el primero
            </Link>
            .
          </p>
        ) : !transactions || transactions.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">
            Sin transacciones {type || assetSymbol || from || to ? "para este filtro" : "todavía"}.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2 font-normal">Fecha</th>
                <th className="py-2 font-normal">Activo</th>
                <th className="py-2 font-normal">Tipo</th>
                <th className="py-2 font-normal text-right">Cantidad</th>
                <th className="py-2 font-normal text-right">Precio</th>
                <th className="py-2 font-normal">Origen</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-border-hairline">
                  <td className="py-2">{new Date(t.executedAt).toLocaleDateString("es-EC")}</td>
                  <td className="py-2 font-medium">{t.assetSymbol}</td>
                  <td className="py-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${TYPE_COLOR[t.type]}`}
                    >
                      {TYPE_LABEL[t.type]}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatQuantity(t.quantity)}</td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(t.price)}</td>
                  <td className="py-2 text-text-secondary">
                    {t.source === "manual" ? "Manual" : "Sincronizada"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
