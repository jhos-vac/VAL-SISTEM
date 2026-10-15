// Orden de la tabla de posiciones.
import type { AssetPosition } from "@val-sistem/shared";

export type SortKey = "alpha" | "pnl" | "pnlPercent" | "value";
export type SortDir = "asc" | "desc";

export const SORT_OPTIONS: Array<{ value: SortKey; label: string; defaultDir: SortDir }> = [
  { value: "alpha", label: "Alfabético", defaultDir: "asc" },
  { value: "pnl", label: "Mejores ganancias ($)", defaultDir: "desc" },
  { value: "pnlPercent", label: "Mejor rendimiento (%)", defaultDir: "desc" },
  { value: "value", label: "Mayor valor", defaultDir: "desc" },
];

export function pnlPercent(p: AssetPosition): number {
  const cost = p.quantity * p.averageCost;
  return cost > 0 ? (p.unrealizedPnl / cost) * 100 : 0;
}

export function sortPositions(
  positions: AssetPosition[],
  key: SortKey,
  dir: SortDir,
): AssetPosition[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...positions].sort((a, b) => {
    let diff: number;
    switch (key) {
      case "alpha":
        diff = a.assetSymbol.localeCompare(b.assetSymbol);
        break;
      case "pnl":
        diff = a.unrealizedPnl - b.unrealizedPnl;
        break;
      case "pnlPercent":
        diff = pnlPercent(a) - pnlPercent(b);
        break;
      case "value":
        diff = a.currentValue - b.currentValue;
        break;
    }
    // Empate: alfabético, para que el orden sea estable.
    return diff !== 0 ? diff * sign : a.assetSymbol.localeCompare(b.assetSymbol);
  });
}
