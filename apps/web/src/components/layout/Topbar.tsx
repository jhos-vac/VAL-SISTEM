"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconBell, IconRefresh, IconSearch } from "@/components/icons";
import { formatCurrency, formatPercent } from "@val-sistem/shared";
import { fetchPortfolios, fetchSummary } from "@/lib/portfolio-client";
import { ALL_PORTFOLIOS_ID, useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";
import { usePortfolioSelectionStore } from "@/store/portfolio-selection-store";
import { useAuthStore } from "@/store/auth-store";
import { logout } from "@/lib/auth-client";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

// Barra superior: portafolio activo + valor total a la izquierda,
// búsqueda, accesos rápidos y sesión a la derecha. El selector cambia
// cuál es "el" portafolio activo para toda la app (RFW-03) —
// ver usePortfolioSelectionStore / useDefaultPortfolio.
export function Topbar() {
  const { portfolio, hasNone, canAggregate } = useDefaultPortfolio();
  const setActivePortfolioId = usePortfolioSelectionStore((s) => s.setActivePortfolioId);
  const { data: portfolios } = useQuery({ queryKey: ["portfolios"], queryFn: fetchPortfolios });
  const { data: summary } = useQuery({
    queryKey: ["portfolio-summary", portfolio?.id],
    queryFn: () => fetchSummary(portfolio!.id),
    enabled: !!portfolio,
  });

  const isUp = (summary?.changePercent24h ?? 0) >= 0;
  const user = useAuthStore((st) => st.user);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border-hairline bg-surface px-4 py-3 md:px-6">
      <div className="flex items-center gap-4">
        {!hasNone && portfolios && portfolios.length > 0 ? (
          <select
            className="rounded-md border border-border-hairline bg-background px-2 py-1 text-sm"
            value={portfolio?.id}
            onChange={(e) => setActivePortfolioId(e.target.value)}
          >
            {canAggregate ? (
              <option value={ALL_PORTFOLIOS_ID}>General (todos)</option>
            ) : null}
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : null}
        {summary ? (
          <div className="hidden items-baseline gap-2 sm:flex">
            <span className="font-[family-name:var(--font-mono)] text-base font-semibold tabular-nums">
              {formatCurrency(summary.totalValue)}
            </span>
            <span
              className={`font-[family-name:var(--font-mono)] text-xs tabular-nums ${
                isUp ? "text-pnl-up" : "text-pnl-down"
              }`}
            >
              {isUp ? "▲" : "▼"} {formatPercent(summary.changePercent24h)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-border-hairline bg-background px-3 py-1.5 text-sm text-text-muted lg:flex">
          <IconSearch className="h-4 w-4" />
          <span className="w-40">Buscar activo…</span>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-foreground"
          title="Refrescar"
        >
          <IconRefresh />
        </button>
        <button
          type="button"
          className="relative rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-foreground"
          title="Notificaciones"
        >
          <IconBell />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-status-critical" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            title={user ? `${user.firstName} ${user.lastName}` : undefined}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-white"
          >
            {user ? initials(user.firstName, user.lastName) : "?"}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-10 z-10 w-48 rounded-md border border-border-hairline bg-surface p-1 shadow-lg">
              <div className="px-2.5 py-1.5 text-xs text-text-muted">
                {user ? `@${user.username}` : ""}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-raised hover:text-foreground"
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
