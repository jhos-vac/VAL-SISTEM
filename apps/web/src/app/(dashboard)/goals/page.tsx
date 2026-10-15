"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Chip, OptionCard } from "@/components/ui/Choice";
import { AssetPicker } from "@/components/strategy/AssetPicker";
import {
  formatCurrency,
  formatPercent,
  GOAL_STATUS_LABELS,
  type Goal,
  type GoalKind,
} from "@val-sistem/shared";
import { createGoal, deleteGoal, fetchGoals } from "@/lib/strategy-client";
import { fetchPositions, fetchSummary } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

const DAY_MS = 86_400_000;
const inputClass = "rounded-md border border-border-hairline bg-background px-3 py-2";

// Metas de ganancia: llegar a un valor (con fecha opcional) o a un % de
// ganancia sobre lo invertido, del portafolio entero o de un activo.
export default function GoalsPage() {
  const queryClient = useQueryClient();
  const { portfolio, isAggregate } = useDefaultPortfolio();
  const [showForm, setShowForm] = useState(false);

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals", portfolio?.id],
    queryFn: () => fetchGoals(portfolio!.id),
    enabled: !!portfolio,
  });

  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });

  const achieved = goals?.filter((g) => g.progress.status === "achieved").length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Metas</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {goals && goals.length > 0
              ? `${achieved} de ${goals.length} cumplida(s).`
              : "Valor a alcanzar o % de ganancia, con su progreso y el ritmo necesario."}
          </p>
        </div>
        {!isAggregate && portfolio && !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-transform active:scale-95"
          >
            Nueva meta
          </button>
        ) : null}
      </div>

      {isAggregate ? (
        <p className="text-sm text-text-secondary">
          Estás en la vista General: se muestran las metas de todos tus portafolios. Para crear una,
          elegí un portafolio.
        </p>
      ) : null}

      {showForm && portfolio ? (
        <GoalForm
          portfolioId={portfolio.id}
          currency={portfolio.baseCurrency}
          onDone={() => setShowForm(false)}
        />
      ) : null}

      {isLoading || !goals ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : goals.length === 0 && !showForm ? (
        <Card>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              Todavía no tenés metas. Por ejemplo: “llegar a 10.000 USD antes de diciembre” o “+10 %
              en BTC”.
            </p>
            {!isAggregate && portfolio ? (
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                Crear mi primera meta
              </button>
            ) : null}
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              currency={portfolio?.baseCurrency ?? "USD"}
              onDelete={() => remove.mutate(g.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tarjeta de meta ---

function GoalCard({
  goal,
  currency,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // Hora tomada una vez al montar (el render tiene que ser puro).
  const [now] = useState(() => Date.now());
  const money = (n: number) => formatCurrency(n, currency);
  const p = goal.progress;
  const isValue = goal.kind === "target_value";
  const tone = p.status === "achieved" ? "good" : p.status === "expired" ? "critical" : "primary";

  // ¿Va a tiempo? Avance de la meta contra tiempo transcurrido desde que se creó.
  const timeProgress = goal.deadline
    ? Math.min(
        1,
        Math.max(
          0,
          (now - new Date(goal.createdAt).getTime()) /
            Math.max(DAY_MS, new Date(goal.deadline).getTime() - new Date(goal.createdAt).getTime()),
        ),
      )
    : null;
  const onTrack = timeProgress === null || p.progress >= timeProgress;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <ProgressRing value={p.progress} label={`Progreso de ${goal.name}`} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{goal.name || (isValue ? "Valor objetivo" : "% de ganancia")}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                p.status === "achieved"
                  ? "bg-status-good/10 text-status-good"
                  : p.status === "expired"
                    ? "bg-status-critical/10 text-status-critical"
                    : "bg-primary-soft text-primary"
              }`}
            >
              {GOAL_STATUS_LABELS[p.status]}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            {goal.assetSymbol ? `${goal.assetSymbol} · ` : ""}
            {isValue ? `Llegar a ${money(goal.targetValue ?? 0)}` : `Ganar ${formatPercent(goal.targetPercent ?? 0)}`}
            {goal.deadline ? ` · hasta el ${new Date(goal.deadline).toLocaleDateString("es-EC")}` : ""}
          </p>
          <p className="mt-2 text-sm tabular-nums">
            <span className="font-semibold">{isValue ? money(p.current) : formatPercent(p.current)}</span>
            <span className="text-text-secondary"> de {isValue ? money(p.target) : formatPercent(p.target)}</span>
          </p>
        </div>
      </div>

      {p.status === "in_progress" ? (
        <div className="mt-4 flex flex-col gap-3">
          {timeProgress !== null ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Avance de la meta</span>
                <span className="tabular-nums">{Math.round(p.progress * 100)}%</span>
              </div>
              <ProgressBar value={p.progress} label="Avance de la meta" tone={tone} />
              <div className="flex justify-between text-text-secondary">
                <span>Tiempo transcurrido</span>
                <span className="tabular-nums">{Math.round(timeProgress * 100)}%</span>
              </div>
              <ProgressBar value={timeProgress} label="Tiempo transcurrido" tone="warning" />
              <p className={onTrack ? "text-status-good" : "text-status-warning"}>
                {onTrack ? "Vas a tiempo." : "Vas por detrás del ritmo necesario."}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Falta" value={money(p.remainingValue)} />
            {p.daysLeft !== null ? (
              <Stat label="Quedan" value={`${p.daysLeft} día(s)`} />
            ) : (
              <Stat label="Valor objetivo" value={money(p.targetValueEquivalent)} />
            )}
            {p.neededPerMonth !== null ? (
              <Stat label="Hace falta por mes" value={money(p.neededPerMonth)} wide />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            ¿Eliminar?
            <button onClick={onDelete} className="font-medium text-status-critical">Sí</button>
            <button onClick={() => setConfirming(false)} className="text-text-secondary">No</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="text-xs text-text-secondary hover:text-status-critical">
            Eliminar meta
          </button>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg bg-surface-raised px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <p className="text-text-muted">{label}</p>
      <p className="font-[family-name:var(--font-mono)] text-sm tabular-nums">{value}</p>
    </div>
  );
}

// --- Formulario con vista previa en vivo ---

const DEADLINE_PRESETS = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "1 año", months: 12 },
] as const;

function addMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function GoalForm({
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("target_value");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const { data: summary } = useQuery({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: () => fetchSummary(portfolioId),
  });
  const { data: positions } = useQuery({
    queryKey: ["positions", portfolioId],
    queryFn: () => fetchPositions(portfolioId),
  });

  // Números actuales de lo que mide la meta (portafolio o activo).
  const base = useMemo(() => {
    if (assetSymbol) {
      const own = (positions ?? []).filter((p) => p.assetSymbol === assetSymbol);
      const value = own.reduce((s, p) => s + p.currentValue, 0);
      const invested = own.reduce((s, p) => s + p.quantity * p.averageCost, 0);
      const gain = own.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0);
      return { value, invested, gain };
    }
    if (!summary) return null;
    return {
      value: summary.totalValue,
      invested: summary.totalInvested,
      gain: summary.unrealizedPnl + summary.realizedPnl,
    };
  }, [assetSymbol, positions, summary]);

  const targetNumber = Number(target.replace(",", "."));
  const valid = name.trim().length > 0 && targetNumber > 0;
  const currentPercent = base && base.invested > 0 ? (base.gain / base.invested) * 100 : 0;
  const targetValue =
    kind === "target_value" ? targetNumber : base ? base.invested * (1 + targetNumber / 100) : 0;
  const remaining = base ? Math.max(0, targetValue - base.value) : 0;
  const monthsLeft = deadline
    ? Math.max((new Date(`${deadline}T23:59:59`).getTime() - now) / (30.44 * DAY_MS), 1 / 30)
    : null;
  const previewProgress =
    kind === "target_value"
      ? base && targetNumber > 0 ? base.value / targetNumber : 0
      : targetNumber > 0 ? currentPercent / targetNumber : 0;

  const valuePresets = base ? [10, 25, 50, 100].map((pct) => ({ pct, value: Math.round(base.value * (1 + pct / 100)) })) : [];
  const percentPresets = [5, 10, 20, 50];

  const mutation = useMutation({
    mutationFn: () =>
      createGoal(portfolioId, {
        name: name.trim(),
        kind,
        ...(kind === "target_value" ? { targetValue: targetNumber } : { targetPercent: targetNumber }),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59`).toISOString() } : {}),
        ...(assetSymbol ? { assetSymbol } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      onDone();
    },
  });

  return (
    <Card title="Nueva meta">
      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-4 text-sm">
          <div role="radiogroup" aria-label="Tipo de meta" className="flex flex-col gap-2 sm:flex-row">
            <OptionCard
              active={kind === "target_value"}
              onClick={() => {
                setKind("target_value");
                setTarget("");
              }}
              title={`Llegar a un valor (${currency})`}
              description="Ej.: tener 10.000 en el portafolio."
            />
            <OptionCard
              active={kind === "gain_percent"}
              onClick={() => {
                setKind("gain_percent");
                setTarget("");
              }}
              title="Ganar un %"
              description="Ej.: +10 % sobre lo invertido."
            />
          </div>

          <label className="flex flex-col gap-1">
            Nombre
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={kind === "target_value" ? "Fondo para 2027" : "BTC +10 %"}
            />
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              {kind === "target_value" ? `Valor objetivo (${currency})` : "Ganancia objetivo (%)"}
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
                className={inputClass}
                placeholder={kind === "target_value" ? "10000" : "10"}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {kind === "target_value"
                ? valuePresets.map((pr) => (
                    <Chip key={pr.pct} active={targetNumber === pr.value} onClick={() => setTarget(String(pr.value))}>
                      +{pr.pct}% · {money(pr.value)}
                    </Chip>
                  ))
                : percentPresets.map((pct) => (
                    <Chip key={pct} active={targetNumber === pct} onClick={() => setTarget(String(pct))}>
                      +{pct}%
                    </Chip>
                  ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span>Fecha límite</span>
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={!deadline} onClick={() => setDeadline("")}>Sin fecha</Chip>
              {DEADLINE_PRESETS.map((d) => (
                <Chip key={d.months} active={deadline === addMonths(d.months)} onClick={() => setDeadline(addMonths(d.months))}>
                  {d.label}
                </Chip>
              ))}
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                aria-label="Elegir otra fecha"
                className="rounded-md border border-border-hairline bg-background px-2 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span>¿De todo el portafolio o de un activo?</span>
            {assetSymbol ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">{assetSymbol}</span>
                <button type="button" onClick={() => setAssetSymbol(null)} className="text-xs text-text-secondary hover:text-foreground">
                  Volver a todo el portafolio
                </button>
              </div>
            ) : (
              <AssetPicker
                label="Elegir un activo (opcional)"
                held={(positions ?? [])
                  .filter((p) => !p.isCapital)
                  .map((p) => ({
                    symbol: p.assetSymbol,
                    currentPercent: summary && summary.totalValue > 0 ? (p.currentValue / summary.totalValue) * 100 : 0,
                  }))}
                exclude={[]}
                onPick={setAssetSymbol}
              />
            )}
          </div>
        </div>

        {/* Vista previa en vivo */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border-hairline bg-surface-raised/50 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Vista previa</p>
          {!base ? (
            <p className="text-text-secondary">Cargando tus números…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <ProgressRing value={previewProgress} label="Progreso actual hacia la meta" size={64} />
                <div>
                  <p className="text-text-secondary">{assetSymbol ? `Hoy en ${assetSymbol}` : "Hoy"}</p>
                  <p className="font-[family-name:var(--font-mono)] text-base font-semibold tabular-nums">
                    {kind === "target_value" ? money(base.value) : formatPercent(currentPercent)}
                  </p>
                </div>
              </div>
              {targetNumber > 0 ? (
                <ul className="space-y-1.5 text-text-secondary">
                  <li>
                    Objetivo:{" "}
                    <span className="text-foreground tabular-nums">
                      {kind === "target_value" ? money(targetNumber) : `${formatPercent(targetNumber)} (${money(targetValue)})`}
                    </span>
                  </li>
                  <li>
                    Falta: <span className="text-foreground tabular-nums">{remaining > 0 ? money(remaining) : "¡ya está cumplida!"}</span>
                  </li>
                  {monthsLeft !== null && remaining > 0 ? (
                    <li>
                      Ritmo necesario:{" "}
                      <span className="text-foreground tabular-nums">{money(remaining / monthsLeft)}</span> por mes
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-text-secondary">Elegí un objetivo para ver cuánto falta.</p>
              )}
            </>
          )}
        </aside>

        <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
          {mutation.isError ? <p className="w-full text-sm text-status-critical">{mutation.error.message}</p> : null}
          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {mutation.isPending ? "Creando…" : "Crear meta"}
          </button>
          <button type="button" onClick={onDone} className="rounded-md border border-border-hairline px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </Card>
  );
}
