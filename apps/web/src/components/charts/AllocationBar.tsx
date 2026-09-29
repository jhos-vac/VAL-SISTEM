"use client";

import type { AssetAllocation } from "@val-sistem/shared";
import { formatCurrency, formatPercent } from "@val-sistem/shared";
import { CATEGORICAL } from "@/lib/chart-colors";

// Composición del portafolio por activo (RFW-04): part-to-whole -> barra
// horizontal apilada con color categórico (choosing-a-form.md). Más de 8
// activos se espera que el caller ya los haya plegado en "Otros" (ver
// mock-data.ts). Direct labels + una tabla accesible debajo, nunca solo el
// color (marks-and-anatomy / anti-patterns).
export function AllocationBar({
  allocation,
  currency = "USD",
}: {
  allocation: AssetAllocation[];
  currency?: string;
}) {
  return (
    <div>
      <div
        className="flex h-6 w-full overflow-hidden rounded-md"
        role="img"
        aria-label={`Composición del portafolio: ${allocation
          .map((a) => `${a.assetName} ${formatPercent(a.percentage)}`)
          .join(", ")}`}
      >
        {allocation.map((item, i) => (
          <div
            key={item.assetSymbol}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: CATEGORICAL[i % CATEGORICAL.length],
              marginRight: i < allocation.length - 1 ? 2 : 0,
            }}
          />
        ))}
      </div>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Detalle de composición por activo</caption>
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-1 font-normal">Activo</th>
            <th className="py-1 font-normal text-right">Valor</th>
            <th className="py-1 font-normal text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {allocation.map((item, i) => (
            <tr key={item.assetSymbol} className="border-t border-border-hairline">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }}
                  />
                  {item.assetName}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatCurrency(item.valueInBaseCurrency, currency)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-text-secondary">
                {formatPercent(item.percentage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
