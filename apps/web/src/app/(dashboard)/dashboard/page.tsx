"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { PnlValue } from "@/components/ui/PnlValue";
import { AllocationBar } from "@/components/charts/AllocationBar";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { formatCurrency } from "@val-sistem/shared";
import { fetchAllocation, fetchPerformance, fetchSummary } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

// RFW-02: dashboard principal — valor total, invertido, ganancia
// realizada/no realizada y variación %, para el portafolio activo.
// Valor/ganancia/composición y el gráfico de rendimiento histórico ya
// son reales (Portfolio + Market + los snapshots diarios que genera
// PortfolioSnapshotService en el backend).
export default function DashboardPage() {
  const { portfolio, hasNone, isLoading: loadingPortfolio } = useDefaultPortfolio();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["portfolio-summary", portfolio?.id],
    queryFn: () => fetchSummary(portfolio!.id),
    enabled: !!portfolio,
  });

  const { data: allocation } = useQuery({
    queryKey: ["portfolio-allocation", portfolio?.id],
    queryFn: () => fetchAllocation(portfolio!.id),
    enabled: !!portfolio,
  });

  const { data: performance } = useQuery({
    queryKey: ["portfolio-performance", portfolio?.id],
    queryFn: () => fetchPerformance(portfolio!.id),
    enabled: !!portfolio,
  });

  if (loadingPortfolio) {
    return <p className="text-sm text-text-secondary">Cargando…</p>;
  }

  if (hasNone) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Todavía no tenés portafolios.{" "}
          <Link href="/portfolios" className="text-primary">
            Creá el primero
          </Link>{" "}
          para ver tu dashboard.
        </p>
      </Card>
    );
  }

  if (loadingSummary || !summary) {
    return <p className="text-sm text-text-secondary">Cargando dashboard…</p>;
  }

  const s = summary;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          Última actualización: {new Date(s.asOf).toLocaleString("es-EC")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Valor total"
          value={formatCurrency(s.totalValue)}
          accent="primary"
          delta={<PnlValue value={s.changePercent24h} asPercent />}
        />
        <StatTile label="Invertido" value={formatCurrency(s.totalInvested)} />
        <StatTile
          label="Ganancia no realizada"
          value={<PnlValue value={s.unrealizedPnl} />}
          accent={s.unrealizedPnl >= 0 ? "gain" : "loss"}
          delta={`Realizada: ${formatCurrency(s.realizedPnl)}`}
        />
        <StatTile
          label="Variación 24h"
          value={<PnlValue value={s.changePercent24h} asPercent />}
          accent={s.changePercent24h >= 0 ? "gain" : "loss"}
        />
      </div>

      <Card title="Rendimiento histórico" accent="primary">
        {performance && performance.length > 0 ? (
          <PerformanceChart data={performance} />
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">
            Todavía no hay histórico — el snapshot diario del portafolio corre una vez por hora,
            volvé a mirar más tarde.
          </p>
        )}
      </Card>

      <Card title="Composición del portafolio">
        {allocation && allocation.length > 0 ? (
          <AllocationBar allocation={allocation} />
        ) : (
          <p className="text-sm text-text-secondary">
            Sin posiciones todavía —{" "}
            <Link href="/transactions/new" className="text-primary">
              registrá tu primera operación
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
