"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  DCA_FREQUENCY_LABELS,
  formatCurrency,
  type DcaFrequency,
  type DcaPlan,
  type RebalancePlan,
} from "@val-sistem/shared";
import {
  createDcaPlan,
  deleteDcaPlan,
  fetchDcaPlans,
  fetchTargetAllocation,
  saveTargetAllocation,
  updateDcaPlan,
} from "@/lib/strategy-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

const inputClass = "rounded-md border border-border-hairline bg-background px-3 py-2";

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
          <DcaCard portfolioId={portfolio.id} currency={portfolio.baseCurrency} />
        </>
      )}
    </div>
  );
}

// --- Asignación objetivo ---

interface Row {
  assetSymbol: string;
  targetPercent: string;
}

function TargetAllocationCard({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row[] | null>(null);
  const { data: plan } = useQuery({
    queryKey: ["target-allocation", portfolioId],
    queryFn: () => fetchTargetAllocation(portfolioId),
  });

  const save = useMutation({
    mutationFn: (rows: Row[]) =>
      saveTargetAllocation(
        portfolioId,
        rows
          .filter((r) => r.assetSymbol.trim() && Number(r.targetPercent) > 0)
          .map((r) => ({
            assetSymbol: r.assetSymbol.trim().toUpperCase(),
            targetPercent: Number(r.targetPercent.replace(",", ".")),
          })),
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData(["target-allocation", portfolioId], updated);
      setEditing(null);
    },
  });

  function startEditing(current: RebalancePlan | undefined) {
    const rows = (current?.rows ?? [])
      .filter((r) => r.targetPercent !== null && r.targetPercent > 0)
      .map((r) => ({ assetSymbol: r.assetSymbol, targetPercent: String(r.targetPercent) }));
    setEditing(rows.length > 0 ? rows : [{ assetSymbol: "", targetPercent: "" }]);
  }

  const editingSum = (editing ?? []).reduce(
    (s, r) => s + (Number(r.targetPercent.replace(",", ".")) || 0),
    0,
  );
  const hasTargets = (plan?.targetsSum ?? 0) > 0;

  return (
    <Card
      title="Asignación objetivo"
      action={
        editing ? null : (
          <button onClick={() => startEditing(plan)} className="text-sm text-primary">
            {hasTargets ? "Editar" : "Definir"}
          </button>
        )
      }
    >
      {editing ? (
        <form
          className="flex max-w-lg flex-col gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(editing);
          }}
        >
          {editing.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label="Activo"
                value={row.assetSymbol}
                onChange={(e) =>
                  setEditing(editing.map((r, j) => (j === i ? { ...r, assetSymbol: e.target.value } : r)))
                }
                placeholder="BTC"
                className={`${inputClass} w-28 uppercase`}
              />
              <input
                aria-label="Porcentaje objetivo"
                value={row.targetPercent}
                onChange={(e) =>
                  setEditing(editing.map((r, j) => (j === i ? { ...r, targetPercent: e.target.value } : r)))
                }
                inputMode="decimal"
                placeholder="50"
                className={`${inputClass} w-24 text-right`}
              />
              <span>%</span>
              <button
                type="button"
                onClick={() => setEditing(editing.filter((_, j) => j !== i))}
                className="text-text-secondary hover:text-status-critical"
                aria-label={`Quitar ${row.assetSymbol || "fila"}`}
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEditing([...editing, { assetSymbol: "", targetPercent: "" }])}
            className="self-start text-primary"
          >
            + Agregar activo
          </button>
          <p className={editingSum > 100 ? "text-status-critical" : "text-text-secondary"}>
            Total: {editingSum.toFixed(2)} %
            {editingSum < 100 ? " — el resto queda libre (no se sugiere nada para lo no asignado)" : ""}
          </p>
          {save.isError ? <p className="text-status-critical">{save.error.message}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={editingSum > 100 || save.isPending}
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md border border-border-hairline px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : !plan ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : !hasTargets ? (
        <p className="text-sm text-text-secondary">
          Definí qué % del portafolio querés en cada activo (por ejemplo 50 % BTC, 30 % ETH, 20 %
          USDT) y te mostramos qué comprar o vender para llegar.
        </p>
      ) : (
        <RebalanceTable plan={plan} currency={currency} />
      )}
    </Card>
  );
}

function RebalanceTable({ plan, currency }: { plan: RebalancePlan; currency: string }) {
  const money = (n: number) => formatCurrency(Math.abs(n), currency);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-2 font-normal">Activo</th>
            <th className="py-2 text-right font-normal">Actual</th>
            <th className="py-2 text-right font-normal">Objetivo</th>
            <th className="py-2 text-right font-normal">Diferencia</th>
            <th className="py-2 text-right font-normal">Para rebalancear</th>
          </tr>
        </thead>
        <tbody>
          {plan.rows.map((r) => (
            <tr key={r.assetId} className="border-t border-border-hairline">
              <td className="py-2 font-medium">{r.assetSymbol}</td>
              <td className="py-2 text-right tabular-nums">{r.currentPercent.toFixed(1)} %</td>
              <td className="py-2 text-right tabular-nums">
                {r.targetPercent === null ? "—" : `${r.targetPercent.toFixed(1)} %`}
              </td>
              <td className="py-2 text-right tabular-nums">
                {r.diffPercent === null
                  ? "—"
                  : `${r.diffPercent > 0 ? "+" : ""}${r.diffPercent.toFixed(1)} pts`}
              </td>
              <td className="py-2 text-right tabular-nums">
                {r.suggestedTrade === null || Math.abs(r.suggestedTrade) < 1 ? (
                  <span className="text-text-secondary">—</span>
                ) : r.suggestedTrade > 0 ? (
                  <span className="text-pnl-up">Comprar {money(r.suggestedTrade)}</span>
                ) : (
                  <span className="text-pnl-down">Vender {money(r.suggestedTrade)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-muted">
        Sobre un valor total de {formatCurrency(plan.totalValue, currency)}. Asignado:{" "}
        {plan.targetsSum.toFixed(2)} %.
      </p>
    </div>
  );
}

// --- Compras periódicas (DCA) ---

function DcaCard({ portfolioId, currency }: { portfolioId: string; currency: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const { data: plans } = useQuery({
    queryKey: ["dca-plans", portfolioId],
    queryFn: () => fetchDcaPlans(portfolioId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dca-plans", portfolioId] });
  const toggle = useMutation({
    mutationFn: (p: DcaPlan) => updateDcaPlan(p.id, { isActive: !p.isActive }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: deleteDcaPlan, onSuccess: invalidate });

  return (
    <Card
      title="Compras periódicas (DCA)"
      action={
        <button onClick={() => setShowForm((v) => !v)} className="text-sm text-primary">
          Nuevo plan
        </button>
      }
    >
      {showForm ? (
        <DcaForm portfolioId={portfolioId} currency={currency} onDone={() => setShowForm(false)} />
      ) : null}
      {!plans ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Planificá compras fijas (por ejemplo 50 USD de BTC por semana) y seguí lo planeado contra
          lo comprado.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {plans.map((p) => {
            const behind = p.progress.investedAmount < p.progress.plannedAmount;
            return (
              <li key={p.id} className="border-t border-border-hairline pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-medium">
                    {formatCurrency(p.amount, currency)} de {p.assetSymbol} ·{" "}
                    {DCA_FREQUENCY_LABELS[p.frequency].toLowerCase()}
                    {!p.isActive ? <span className="ml-2 text-text-muted">(pausado)</span> : null}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => toggle.mutate(p)} className="text-text-secondary hover:text-foreground">
                      {p.isActive ? "Pausar" : "Reanudar"}
                    </button>
                    <button onClick={() => remove.mutate(p.id)} className="text-text-secondary hover:text-status-critical">
                      Eliminar
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={p.progress.progress}
                    label={`Plan de ${p.assetSymbol}`}
                    tone={behind ? "warning" : "good"}
                  />
                </div>
                <p className="mt-1 text-sm text-text-secondary tabular-nums">
                  Planeado hasta hoy {formatCurrency(p.progress.plannedAmount, currency)} (
                  {p.progress.periodsDue} compra(s)) · comprado{" "}
                  {formatCurrency(p.progress.investedAmount, currency)} en {p.assetSymbol} desde el
                  inicio del plan
                  {p.progress.nextDate
                    ? ` · próxima: ${new Date(p.progress.nextDate).toLocaleDateString("es-EC")}`
                    : " · plan terminado"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DcaForm({
  portfolioId,
  currency,
  onDone,
}: {
  portfolioId: string;
  currency: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [assetSymbol, setAssetSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<DcaFrequency>("weekly");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createDcaPlan(portfolioId, {
        assetSymbol: assetSymbol.trim().toUpperCase(),
        amount: Number(amount.replace(",", ".")),
        frequency,
        startDate: new Date(`${startDate}T00:00:00`).toISOString(),
        ...(endDate ? { endDate: new Date(`${endDate}T23:59:59`).toISOString() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dca-plans", portfolioId] });
      onDone();
    },
  });
  const valid = assetSymbol.trim().length > 0 && Number(amount.replace(",", ".")) > 0 && !!startDate;

  return (
    <form
      className="mb-4 grid max-w-lg gap-3 text-sm sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <label className="flex flex-col gap-1">
        Activo
        <input value={assetSymbol} onChange={(e) => setAssetSymbol(e.target.value)} placeholder="BTC" className={`${inputClass} uppercase`} />
      </label>
      <label className="flex flex-col gap-1">
        Monto por compra ({currency})
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="50" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        Frecuencia
        <select value={frequency} onChange={(e) => setFrequency(e.target.value as DcaFrequency)} className={inputClass}>
          {(Object.keys(DCA_FREQUENCY_LABELS) as DcaFrequency[]).map((f) => (
            <option key={f} value={f}>
              {DCA_FREQUENCY_LABELS[f]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Desde
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1">
        Hasta (opcional)
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
      </label>
      {mutation.isError ? <p className="text-status-critical sm:col-span-2">{mutation.error.message}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={!valid || mutation.isPending}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          Crear plan
        </button>
        <button type="button" onClick={onDone} className="rounded-md border border-border-hairline px-3 py-1.5">
          Cancelar
        </button>
      </div>
    </form>
  );
}
