"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { formatCurrency, formatPercent, formatQuantity } from "@val-sistem/shared";
import type { AssetPosition } from "@val-sistem/shared";
import { fetchPositions, fetchWallets, type Wallet } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";
import {
  pnlPercent,
  SORT_OPTIONS,
  sortPositions,
  type SortDir,
  type SortKey,
} from "@val-sistem/shared";

const SORT_STORAGE_KEY = "val.positions.sort";

// Orden elegido, recordado en este navegador. Comodidad: si el storage no
// está disponible se usa el orden por defecto. useSyncExternalStore evita
// diferencias entre el render del servidor (sin storage) y el del cliente.
const SORT_EVENT = "val:positions-sort";
const DEFAULT_SORT = { key: "value" as SortKey, dir: "desc" as SortDir };

// Respaldo en memoria por si el storage no está disponible.
let memorySort: string | null = null;

function readSort(): string | null {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) ?? memorySort;
  } catch {
    return memorySort;
  }
}

function subscribeSort(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SORT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SORT_EVENT, onChange);
  };
}

function parseSort(raw: string | null): { key: SortKey; dir: SortDir } {
  try {
    const saved = JSON.parse(raw ?? "null") as { key?: SortKey; dir?: SortDir } | null;
    if (saved?.key && SORT_OPTIONS.some((o) => o.value === saved.key)) {
      return { key: saved.key, dir: saved.dir === "asc" ? "asc" : "desc" };
    }
  } catch {
    // valor corrupto: orden por defecto
  }
  return DEFAULT_SORT;
}

function useRememberedSort(): [SortKey, SortDir, (key: SortKey, dir?: SortDir) => void] {
  const raw = useSyncExternalStore(subscribeSort, readSort, () => null);
  const { key, dir } = parseSort(raw);
  const set = (nextKey: SortKey, nextDir?: SortDir) => {
    const next = {
      key: nextKey,
      dir: nextDir ?? SORT_OPTIONS.find((o) => o.value === nextKey)?.defaultDir ?? "desc",
    };
    memorySort = JSON.stringify(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, memorySort);
    } catch {
      // sin storage: queda solo en memoria hasta recargar
    }
    window.dispatchEvent(new Event(SORT_EVENT));
  };
  return [key, dir, set];
}

export default function PositionsPage() {
  const { portfolio, hasNone, isLoading: loadingPortfolio } = useDefaultPortfolio();
  const [sortKey, sortDir, setSort] = useRememberedSort();

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", portfolio?.id],
    queryFn: () => fetchPositions(portfolio!.id),
    enabled: !!portfolio,
  });

  const { data: wallets, isLoading: loadingWallets } = useQuery({
    queryKey: ["wallets", portfolio?.id],
    queryFn: () => fetchWallets(portfolio!.id),
    enabled: !!portfolio,
  });

  const walletNameById = new Map<string, Wallet>((wallets ?? []).map((w) => [w.id, w]));

  const groups = groupPositionsByWallet(positions ?? [], walletNameById);

  const busy = loadingPortfolio || isLoading || loadingWallets;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Posiciones</h1>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="positions-sort" className="text-text-secondary">
            Ordenar por
          </label>
          <select
            id="positions-sort"
            value={sortKey}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-border-hairline bg-background px-2 py-1.5"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSort(sortKey, sortDir === "asc" ? "desc" : "asc")}
            className="rounded-md border border-border-hairline px-2 py-1.5 transition-colors hover:border-primary hover:text-primary"
            aria-label={sortDir === "asc" ? "Orden ascendente; cambiar a descendente" : "Orden descendente; cambiar a ascendente"}
            title={sortDir === "asc" ? "Ascendente" : "Descendente"}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {busy ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">Cargando…</p>
        </Card>
      ) : hasNone ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">
            Todavía no tenés portafolios.{" "}
            <Link href="/portfolios" className="text-primary">
              Creá el primero
            </Link>
            .
          </p>
        </Card>
      ) : !positions || positions.length === 0 ? (
        <Card>
          <p className="py-4 text-sm text-text-secondary">
            Sin posiciones todavía —{" "}
            <Link href="/transactions/new" className="text-primary">
              registrá tu primera operación
            </Link>
            .
          </p>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.walletId}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{group.walletLabel}</h2>
              <span className="text-xs text-text-secondary">
                {group.positions.length}{" "}
                {group.positions.length === 1 ? "posición" : "posiciones"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <SortHeader label="Activo" sortFor="alpha" current={sortKey} dir={sortDir} onSort={setSort} />
                    <th className="py-2 font-normal text-right">Cantidad</th>
                    <th className="py-2 font-normal text-right">Costo prom.</th>
                    <th className="py-2 font-normal text-right">Precio actual</th>
                    <SortHeader label="Valor" sortFor="value" current={sortKey} dir={sortDir} onSort={setSort} align="right" />
                    <SortHeader
                      label="Ganancia no realizada"
                      sortFor="pnl"
                      altSortFor="pnlPercent"
                      current={sortKey}
                      dir={sortDir}
                      onSort={setSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortPositions(group.positions, sortKey, sortDir).map((pos) => (
                    <tr key={pos.id} className="border-t border-border-hairline transition-colors hover:bg-surface-raised/60">
                      <td className="py-2 font-medium">
                        <Link
                          href={`/lots?asset=${pos.assetSymbol}`}
                          className="hover:text-primary hover:underline"
                          title="Ver cada compra de este activo"
                        >
                          {pos.assetSymbol}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatQuantity(pos.quantity)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.averageCost)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.currentPrice)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(pos.currentValue)}
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex flex-col items-end">
                          <PnlValue value={pos.unrealizedPnl} />
                          <span className="text-xs text-text-secondary">{formatPercent(pnlPercent(pos))}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

interface PositionGroup {
  walletId: string;
  walletLabel: string;
  positions: AssetPosition[];
}

function groupPositionsByWallet(
  positions: AssetPosition[],
  walletNameById: Map<string, Wallet>,
): PositionGroup[] {
  const byWallet = new Map<string, AssetPosition[]>();
  for (const pos of positions) {
    const list = byWallet.get(pos.walletId) ?? [];
    list.push(pos);
    byWallet.set(pos.walletId, list);
  }

  const groups: PositionGroup[] = [];
  for (const [walletId, list] of byWallet) {
    const wallet = walletNameById.get(walletId);
    groups.push({
      walletId,
      // Wallet eliminada u otra inconsistencia: mostramos un id truncado
      // en vez de ocultar la posición.
      walletLabel: wallet ? wallet.walletName : `Wallet ${walletId.slice(0, 8)}…`,
      positions: list,
    });
  }

  groups.sort((a, b) => a.walletLabel.localeCompare(b.walletLabel));
  return groups;
}

// Encabezado ordenable: un clic ordena por esa columna y otro invierte la
// dirección. La columna de ganancia alterna entre $ y %.
function SortHeader({
  label,
  sortFor,
  altSortFor,
  current,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortFor: SortKey;
  altSortFor?: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey, dir?: SortDir) => void;
  align?: "left" | "right";
}) {
  const active = current === sortFor || current === altSortFor;
  const ariaSort = active ? (dir === "asc" ? "ascending" : "descending") : "none";
  function handleClick() {
    if (!active) return onSort(sortFor);
    if (altSortFor && current === sortFor && dir === "desc") return onSort(altSortFor);
    if (altSortFor && current === altSortFor) return onSort(sortFor);
    onSort(current, dir === "asc" ? "desc" : "asc");
  }
  return (
    <th aria-sort={ariaSort} className={`py-2 font-normal ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active && current === altSortFor ? <span className="text-xs">(%)</span> : null}
        <span aria-hidden="true" className={active ? "" : "opacity-30"}>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
