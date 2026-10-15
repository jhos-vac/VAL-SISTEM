"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { fetchTargetAllocation, saveTargetAllocation } from "@/lib/strategy-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";
import { TargetAllocationEditor } from "@/components/strategy/TargetAllocationEditor";
import { AllocationView } from "@/components/strategy/AllocationView";
import type { DraftRow } from "@val-sistem/shared";
import { DcaSection } from "@/components/strategy/DcaSection";

// Estrategia del portafolio: % objetivo por activo (con qué comprar o
// vender para acercarse) y planes de compra periódica (DCA).
export default function StrategyPage() {
  const { portfolio, isAggregate } = useDefaultPortfolio();

  if (!portfolio) return <p className="text-sm text-text-secondary">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Estrategia</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Definí cómo querés repartir el portafolio y tus compras periódicas.
        </p>
      </div>
      {isAggregate ? (
        <Card>
          <p className="text-sm text-text-secondary">
            La estrategia es de cada portafolio: elegí uno en el selector de arriba.
          </p>
        </Card>
      ) : (
        <>
          <TargetAllocationCard portfolioId={portfolio.id} currency={portfolio.baseCurrency} />
          <DcaSection portfolioId={portfolio.id} currency={portfolio.baseCurrency} />
        </>
      )}
    </div>
  );
}

// --- Asignación objetivo ---

function TargetAllocationCard({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: plan } = useQuery({
    queryKey: ["target-allocation", portfolioId],
    queryFn: () => fetchTargetAllocation(portfolioId),
  });

  const save = useMutation({
    mutationFn: (rows: DraftRow[]) =>
      saveTargetAllocation(
        portfolioId,
        rows.map((r) => ({ assetSymbol: r.assetSymbol, targetPercent: r.percent })),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["target-allocation", portfolioId], updated);
      setEditing(false);
    },
  });

  const hasTargets = (plan?.targetsSum ?? 0) > 0;

  return (
    <Card
      title="Asignación objetivo"
      action={
        editing || !plan ? null : (
          <button
            onClick={() => {
              save.reset();
              setEditing(true);
            }}
            className="rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary-soft"
          >
            {hasTargets ? "Editar estrategia" : "Definir estrategia"}
          </button>
        )
      }
    >
      {!plan ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : editing ? (
        <TargetAllocationEditor
          plan={plan}
          currency={currency}
          saving={save.isPending}
          error={save.isError ? save.error.message : null}
          onSave={(rows) => save.mutate(rows)}
          onCancel={() => setEditing(false)}
        />
      ) : !hasTargets ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-secondary">
            Definí qué % del portafolio querés en cada activo (por ejemplo 50 % BTC, 30 % ETH, 20 %
            USDT) y te mostramos qué comprar o vender para llegar.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Armar mi estrategia
          </button>
        </div>
      ) : (
        <AllocationView plan={plan} currency={currency} />
      )}
    </Card>
  );
}
