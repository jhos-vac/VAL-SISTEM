"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Chip, Segmented } from "@/components/ui/Choice";
import {
  DCA_FREQUENCY_LABELS,
  formatCurrency,
  type DcaFrequency,
  type DcaPlan,
} from "@val-sistem/shared";
import {
  createDcaPlan,
  deleteDcaPlan,
  fetchDcaPlans,
  updateDcaPlan,
} from "@/lib/strategy-client";
import { fetchPositions } from "@/lib/portfolio-client";
import { AssetPicker } from "./AssetPicker";

const DAY_MS = 86_400_000;

function addPeriods(start: Date, frequency: DcaFrequency, n: number): Date {
  const d = new Date(start.getTime());
  if (frequency === "monthly") d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n * (frequency === "weekly" ? 7 : 14));
  return d;
}

// Compras que caen entre start y start + meses.
function purchasesWithin(start: Date, frequency: DcaFrequency, months: number): number {
  const end = new Date(start.getTime());
  end.setMonth(end.getMonth() + months);
  let n = 0;
  while (addPeriods(start, frequency, n) < end) n++;
  return n;
}

// Compras periódicas (DCA): planes con su estado y un formulario con
// proyección en vivo.
export function DcaSection({ portfolioId, currency }: { portfolioId: string; currency: string }) {
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
        showForm ? null : (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md px-2 py-1 text-sm text-primary transition-colors hover:bg-primary-soft"
          >
            Nuevo plan
          </button>
        )
      }
    >
      {showForm ? (
        <DcaForm portfolioId={portfolioId} currency={currency} onDone={() => setShowForm(false)} />
      ) : null}
      {!plans ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : plans.length === 0 && !showForm ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-secondary">
            Planificá compras fijas (por ejemplo 50 USD de BTC por semana) y seguí lo planeado contra
            lo comprado.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Crear un plan
          </button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => (
            <DcaPlanCard
              key={p.id}
              plan={p}
              currency={currency}
              onToggle={() => toggle.mutate(p)}
              onDelete={() => remove.mutate(p.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function DcaPlanCard({
  plan,
  currency,
  onToggle,
  onDelete,
}: {
  plan: DcaPlan;
  currency: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [now] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const money = (n: number) => formatCurrency(n, currency);
  const { plannedAmount, investedAmount, nextDate, periodsDue } = plan.progress;
  const ratio = plannedAmount > 0 ? investedAmount / plannedAmount : 0;
  const status = !plan.isActive
    ? { label: "Pausado", className: "bg-surface-raised text-text-secondary", tone: "warning" as const }
    : ratio >= 1.05
      ? { label: "Adelantado", className: "bg-status-good/10 text-status-good", tone: "good" as const }
      : ratio >= 0.95
        ? { label: "Al día", className: "bg-status-good/10 text-status-good", tone: "good" as const }
        : { label: "Atrasado", className: "bg-status-warning/10 text-status-warning", tone: "warning" as const };
  const daysToNext = nextDate ? Math.max(0, Math.ceil((new Date(nextDate).getTime() - now) / DAY_MS)) : null;
  const maxBar = Math.max(plannedAmount, investedAmount, 1);

  return (
    <li className="rounded-xl border border-border-hairline p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <ProgressRing value={ratio} label={`Plan de ${plan.assetSymbol}`} tone={status.tone} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              {money(plan.amount)} de {plan.assetSymbol}
            </p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            {DCA_FREQUENCY_LABELS[plan.frequency]} · desde {new Date(plan.startDate).toLocaleDateString("es-EC")}
          </p>
          <p className="mt-1 text-xs">
            {nextDate
              ? daysToNext === 0
                ? "Toca comprar hoy"
                : `Próxima compra en ${daysToNext} día(s)`
              : "Plan terminado"}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs">
        <BarRow label={`Planeado (${periodsDue} compras)`} value={plannedAmount} max={maxBar} color="var(--text-muted)" money={money} />
        <BarRow label={`Comprado en ${plan.assetSymbol}`} value={investedAmount} max={maxBar} color="var(--primary)" money={money} />
        <p className="text-text-muted">Cuenta todas tus compras de {plan.assetSymbol} desde el inicio del plan.</p>
      </div>

      <div className="mt-3 flex justify-end gap-3 text-xs">
        <button onClick={onToggle} className="text-text-secondary hover:text-foreground">
          {plan.isActive ? "Pausar" : "Reanudar"}
        </button>
        {confirming ? (
          <span className="flex items-center gap-2">
            ¿Eliminar?
            <button onClick={onDelete} className="font-medium text-status-critical">Sí</button>
            <button onClick={() => setConfirming(false)} className="text-text-secondary">No</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-text-secondary hover:text-status-critical">
            Eliminar
          </button>
        )}
      </div>
    </li>
  );
}

function BarRow({
  label,
  value,
  max,
  color,
  money,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  money: (n: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between text-text-secondary">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{money(value)}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// --- Formulario con proyección ---

const AMOUNT_PRESETS = [25, 50, 100, 250];

function startPresets(): Array<{ label: string; date: string }> {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monday = new Date(today);
  monday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return [
    { label: "Hoy", date: iso(today) },
    { label: "Próximo lunes", date: iso(monday) },
    { label: "1° del mes", date: iso(firstOfMonth) },
  ];
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
  const money = (n: number) => formatCurrency(n, currency);
  const presets = useMemo(() => startPresets(), []);
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);
  const [amount, setAmount] = useState("50");
  const [frequency, setFrequency] = useState<DcaFrequency>("weekly");
  const [startDate, setStartDate] = useState(presets[0].date);
  const [endDate, setEndDate] = useState("");

  const { data: positions } = useQuery({
    queryKey: ["positions", portfolioId],
    queryFn: () => fetchPositions(portfolioId),
  });
  const totalValue = (positions ?? []).reduce((s, p) => s + p.currentValue, 0);

  const amountNumber = Number(amount.replace(",", "."));
  const valid = !!assetSymbol && amountNumber > 0 && !!startDate;
  const start = new Date(`${startDate}T00:00:00`);
  const next = [0, 1, 2, 3].map((n) => addPeriods(start, frequency, n));
  const projection = [6, 12].map((months) => {
    const n = purchasesWithin(start, frequency, months);
    return { months, n, total: n * (amountNumber || 0) };
  });

  const mutation = useMutation({
    mutationFn: () =>
      createDcaPlan(portfolioId, {
        assetSymbol: assetSymbol!,
        amount: amountNumber,
        frequency,
        startDate: start.toISOString(),
        ...(endDate ? { endDate: new Date(`${endDate}T23:59:59`).toISOString() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dca-plans", portfolioId] });
      onDone();
    },
  });

  return (
    <form
      className="mb-5 grid gap-5 rounded-xl border border-border-hairline p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          <span>Activo</span>
          {assetSymbol ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-soft px-3 py-1 font-medium text-primary">{assetSymbol}</span>
              <button type="button" onClick={() => setAssetSymbol(null)} className="text-xs text-text-secondary hover:text-foreground">
                Cambiar
              </button>
            </div>
          ) : (
            <AssetPicker
              label="Elegir activo"
              held={(positions ?? [])
                .filter((p) => !p.isCapital)
                .map((p) => ({
                  symbol: p.assetSymbol,
                  currentPercent: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0,
                }))}
              exclude={[]}
              onPick={setAssetSymbol}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="dca-amount">Monto por compra ({currency})</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="dca-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-28 rounded-md border border-border-hairline bg-background px-3 py-2"
            />
            {AMOUNT_PRESETS.map((a) => (
              <Chip key={a} active={amountNumber === a} onClick={() => setAmount(String(a))}>
                {money(a)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span>Frecuencia</span>
          <Segmented
            label="Frecuencia"
            value={frequency}
            onChange={setFrequency}
            options={(Object.keys(DCA_FREQUENCY_LABELS) as DcaFrequency[]).map((f) => ({
              value: f,
              label: DCA_FREQUENCY_LABELS[f],
            }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span>Empieza</span>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <Chip key={p.label} active={startDate === p.date} onClick={() => setStartDate(p.date)}>
                {p.label}
              </Chip>
            ))}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Elegir otra fecha de inicio"
              className="rounded-md border border-border-hairline bg-background px-2 py-1 text-xs"
            />
          </div>
        </div>

        <label className="flex flex-col gap-1">
          Termina (opcional)
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-44 rounded-md border border-border-hairline bg-background px-2 py-1.5"
          />
        </label>
      </div>

      <aside className="flex flex-col gap-3 rounded-xl bg-surface-raised/50 p-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Proyección</p>
        <div className="grid grid-cols-2 gap-2">
          {projection.map((p) => (
            <div key={p.months} className="rounded-lg bg-background/60 p-3">
              <p className="text-xs text-text-muted">{p.months === 12 ? "En 1 año" : `En ${p.months} meses`}</p>
              <p className="font-[family-name:var(--font-mono)] text-base font-semibold tabular-nums">{money(p.total)}</p>
              <p className="text-xs text-text-secondary">{p.n} compras</p>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs text-text-muted">Próximas compras</p>
          <ol className="space-y-1">
            {next.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                {d.toLocaleDateString("es-EC", { weekday: "short", day: "numeric", month: "short" })}
                <span className="ml-auto tabular-nums text-text-secondary">
                  {assetSymbol ? `${money(amountNumber || 0)} de ${assetSymbol}` : money(amountNumber || 0)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
        {mutation.isError ? <p className="w-full text-sm text-status-critical">{mutation.error.message}</p> : null}
        <button
          type="submit"
          disabled={!valid || mutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
        >
          {mutation.isPending ? "Creando…" : "Crear plan"}
        </button>
        <button type="button" onClick={onDone} className="rounded-md border border-border-hairline px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
