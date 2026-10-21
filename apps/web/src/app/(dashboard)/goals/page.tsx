"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Chip, OptionCard } from "@/components/ui/Choice";
import { AssetPicker } from "@/components/strategy/AssetPicker";
import { GoalMilestones, GoalPlanSuggestion, GoalSparkline } from "@/components/goals/GoalExtras";
import {
  defaultGoalName,
  formatCurrency,
  formatGoalMetric,
  formatPercent,
  formatQuantity,
  GOAL_STATUS_LABELS,
  goalTargetText,
  isAssetGoalKind,
  projectionText,
  type Goal,
  type GoalKind,
} from "@val-sistem/shared";
import { createGoal, deleteGoal, fetchGoals, updateGoal } from "@/lib/strategy-client";
import { fetchPositions, fetchSummary } from "@/lib/portfolio-client";
import { fetchTickers } from "@/lib/market-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

const DAY_MS = 86_400_000;
const inputClass = "rounded-md border border-border-hairline bg-background px-3 py-2";

// Metas: llegar a un valor, ganar un %, juntar una cantidad de una moneda o
// que una moneda llegue a un precio. Con progreso, ritmo necesario y
// proyección (a este ritmo, cuándo se cumple).
export default function GoalsPage() {
  const queryClient = useQueryClient();
  const { portfolio, isAggregate } = useDefaultPortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals", portfolio?.id],
    queryFn: () => fetchGoals(portfolio!.id),
    enabled: !!portfolio,
  });

  const remove = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });

  const achievedGoals = goals?.filter((g) => g.progress.status === "achieved") ?? [];
  const activeGoals = goals?.filter((g) => g.progress.status !== "achieved") ?? [];
  const achieved = achievedGoals.length;
  const currency = portfolio?.baseCurrency ?? "USD";
  const renderGoal = (g: Goal) =>
    editingId === g.id ? (
      <div key={g.id} className="md:col-span-2">
        <GoalForm portfolioId={g.portfolioId} currency={currency} editing={g} onDone={() => setEditingId(null)} />
      </div>
    ) : (
      <GoalCard
        key={g.id}
        goal={g}
        currency={currency}
        onEdit={() => {
          setShowForm(false);
          setEditingId(g.id);
        }}
        onDelete={() => remove.mutate(g.id)}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Metas</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {goals && goals.length > 0
              ? `${achieved} de ${goals.length} cumplida(s).`
              : "Un valor, un % de ganancia, una cantidad de una moneda o un precio objetivo."}
          </p>
        </div>
        {!isAggregate && portfolio && !showForm ? (
          <button
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-transform active:scale-95"
          >
            Nueva meta
          </button>
        ) : null}
      </div>

      {isAggregate ? (
        <p className="text-sm text-text-secondary">
          Estás en la vista General: se muestran las metas de todos tus portafolios. Para crear una,
          elige un portafolio.
        </p>
      ) : null}

      {showForm && portfolio ? (
        <GoalForm portfolioId={portfolio.id} currency={currency} onDone={() => setShowForm(false)} />
      ) : null}

      {isLoading || !goals ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : goals.length === 0 && !showForm ? (
        <Card>
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-text-secondary">
              Todavía no tienes metas. Por ejemplo: “llegar a 10.000 USD antes de diciembre”, “tener 0,5 BTC”
              o “ETH a 4.000”.
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
        <>
          {activeGoals.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">{activeGoals.map(renderGoal)}</div>
          ) : (
            <p className="text-sm text-text-secondary">No tienes metas en curso.</p>
          )}
          {achievedGoals.length > 0 ? (
            <details className="group" open={activeGoals.length === 0}>
              <summary className="cursor-pointer select-none text-sm font-medium text-text-secondary hover:text-foreground">
                Cumplidas ({achievedGoals.length})
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">{achievedGoals.map(renderGoal)}</div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

// --- Tarjeta de meta ---

function GoalCard({
  goal,
  currency,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  // Hora tomada una vez al montar (el render tiene que ser puro).
  const [now] = useState(() => Date.now());
  const money = (n: number) => formatCurrency(n, currency);
  const metric = (n: number) => formatGoalMetric(goal.kind, n, money, goal.assetSymbol);
  const p = goal.progress;
  const tone = p.status === "achieved" ? "good" : p.status === "expired" ? "critical" : "primary";
  const projection = projectionText(goal, money);

  // ¿Va a tiempo? Avance de la meta contra tiempo transcurrido desde que se creó.
  const timeProgress =
    goal.deadline && goal.kind !== "target_price"
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
            <p className="truncate font-medium">{goal.name || goalTargetText(goal, money)}</p>
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
            {goalTargetText(goal, money)}
            {goal.deadline ? ` · hasta el ${new Date(goal.deadline).toLocaleDateString("es-EC")}` : ""}
          </p>
          <p className="mt-2 text-sm tabular-nums">
            <span className="font-semibold">{metric(p.current)}</span>
            <span className="text-text-secondary"> de {metric(p.target)}</span>
          </p>
          {p.status === "achieved" ? (
            <p className="text-xs font-medium text-status-good">¡Meta cumplida!</p>
          ) : null}
          {goal.kind === "target_price" && goal.completedAt ? (
            <p className="text-xs text-status-good">
              Tocó el precio el {new Date(goal.completedAt).toLocaleDateString("es-EC")}.
            </p>
          ) : null}
        </div>
      </div>

      {p.status !== "achieved" ? (
        <div className="mt-3 flex flex-col gap-2">
          <GoalSparkline goal={goal} tone={tone} format={metric} />
          {goal.kind !== "target_price" ? <GoalMilestones goal={goal} /> : null}
        </div>
      ) : null}

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
            {goal.kind === "target_price" ? (
              <Stat
                label={goal.priceDirection === "below" ? "Tiene que bajar" : "Tiene que subir"}
                value={formatPercent(Math.abs(p.current > 0 ? ((p.target - p.current) / p.current) * 100 : 0)).replace(/^\+/, "")}
              />
            ) : goal.kind === "asset_quantity" ? (
              <Stat
                label="Falta"
                value={`${formatQuantity(Math.max(0, p.target - p.current))} ${goal.assetSymbol ?? ""} · ${money(p.remainingValue)}`}
                wide
              />
            ) : (
              <Stat label="Falta" value={money(p.remainingValue)} />
            )}
            {p.daysLeft !== null ? (
              <Stat label="Quedan" value={`${p.daysLeft} día(s)`} />
            ) : goal.kind !== "target_price" && goal.kind !== "asset_quantity" ? (
              <Stat label="Valor objetivo" value={money(p.targetValueEquivalent)} />
            ) : null}
            {p.neededPerMonth !== null ? (
              <Stat label="Hace falta por mes" value={money(p.neededPerMonth)} wide />
            ) : null}
          </div>
          {projection ? (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${
                projection.tone === "good"
                  ? "bg-status-good/10 text-status-good"
                  : projection.tone === "warning"
                    ? "bg-status-warning/10 text-status-warning"
                    : "bg-surface-raised text-text-secondary"
              }`}
            >
              {projection.text}
            </p>
          ) : null}
          <GoalPlanSuggestion goal={goal} money={money} />
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-4">
        {confirming ? (
          <span className="flex items-center gap-2 text-xs">
            ¿Eliminar?
            <button onClick={onDelete} className="font-medium text-status-critical">Sí</button>
            <button onClick={() => setConfirming(false)} className="text-text-secondary">No</button>
          </span>
        ) : (
          <>
            <button onClick={onEdit} className="text-xs text-text-secondary hover:text-foreground">
              Editar
            </button>
            <button onClick={() => setConfirming(true)} className="text-xs text-text-secondary hover:text-status-critical">
              Eliminar
            </button>
          </>
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

// --- Formulario (crear o editar) con vista previa en vivo ---

const KINDS: Array<{ kind: GoalKind; title: (currency: string) => string; description: string }> = [
  { kind: "target_value", title: (c) => `Llegar a un valor (${c})`, description: "Ej.: tener 10.000 en el portafolio." },
  { kind: "gain_percent", title: () => "Ganar un %", description: "Ej.: +10 % sobre lo invertido." },
  { kind: "asset_quantity", title: () => "Juntar una cantidad", description: "Ej.: tener 0,5 BTC." },
  { kind: "target_price", title: () => "Precio objetivo", description: "Ej.: ETH a 4.000 (sube o baja)." },
];

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

function targetOf(goal: Goal): number | null {
  switch (goal.kind) {
    case "target_value":
      return goal.targetValue;
    case "gain_percent":
      return goal.targetPercent;
    case "asset_quantity":
      return goal.targetQuantity;
    case "target_price":
      return goal.targetPrice;
  }
}

// Redondea una cantidad a pocas cifras significativas (para los atajos).
function roundQty(n: number): number {
  if (n <= 0) return 0;
  const digits = Math.max(0, 3 - Math.floor(Math.log10(n)));
  return Number(n.toFixed(Math.min(8, digits)));
}

function GoalForm({
  portfolioId,
  currency,
  editing,
  onDone,
}: {
  portfolioId: string;
  currency: string;
  editing?: Goal;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const money = (n: number) => formatCurrency(n, currency);
  const [kind, setKind] = useState<GoalKind>(editing?.kind ?? "target_value");
  const [name, setName] = useState(editing?.name ?? "");
  const [target, setTarget] = useState(editing ? String(targetOf(editing) ?? "") : "");
  const [deadline, setDeadline] = useState(editing?.deadline?.slice(0, 10) ?? "");
  const [assetSymbol, setAssetSymbol] = useState<string | null>(editing?.assetSymbol ?? null);
  const [now] = useState(() => Date.now());
  const needsAsset = isAssetGoalKind(kind);

  const { data: summary } = useQuery({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: () => fetchSummary(portfolioId),
  });
  const { data: positions } = useQuery({
    queryKey: ["positions", portfolioId],
    queryFn: () => fetchPositions(portfolioId),
  });
  const { data: tickers } = useQuery({
    queryKey: ["tickers"],
    queryFn: () => fetchTickers(),
    enabled: needsAsset,
  });

  // Números actuales de lo que mide la meta (portafolio o activo).
  const base = useMemo(() => {
    if (assetSymbol) {
      const own = (positions ?? []).filter((p) => p.assetSymbol === assetSymbol);
      const price =
        tickers?.find((t) => t.assetSymbol === assetSymbol)?.price ?? own[0]?.currentPrice ?? 0;
      return {
        value: own.reduce((s, p) => s + p.currentValue, 0),
        invested: own.reduce((s, p) => s + p.quantity * p.averageCost, 0),
        gain: own.reduce((s, p) => s + p.unrealizedPnl + p.realizedPnl, 0),
        quantity: own.reduce((s, p) => s + p.quantity, 0),
        price,
      };
    }
    if (!summary) return null;
    return {
      value: summary.totalValue,
      invested: summary.totalInvested,
      gain: summary.unrealizedPnl + summary.realizedPnl,
      quantity: 0,
      price: 0,
    };
  }, [assetSymbol, positions, summary, tickers]);

  const targetNumber = Number(target.replace(",", "."));
  const valid = targetNumber > 0 && (!needsAsset || !!assetSymbol);
  const currentPercent = base && base.invested > 0 ? (base.gain / base.invested) * 100 : 0;

  // Vista previa según el tipo.
  const preview = (() => {
    if (!base) return null;
    switch (kind) {
      case "target_value":
      case "gain_percent": {
        const targetValue = kind === "target_value" ? targetNumber : base.invested * (1 + targetNumber / 100);
        return {
          current: kind === "target_value" ? money(base.value) : formatPercent(currentPercent),
          progress: kind === "target_value" ? (targetNumber > 0 ? base.value / targetNumber : 0) : targetNumber > 0 ? currentPercent / targetNumber : 0,
          target: kind === "target_value" ? money(targetNumber) : `${formatPercent(targetNumber)} (${money(targetValue)})`,
          remainingValue: Math.max(0, targetValue - base.value),
        };
      }
      case "asset_quantity": {
        const missing = Math.max(0, targetNumber - base.quantity);
        return {
          current: `${formatQuantity(base.quantity)} ${assetSymbol ?? ""}`,
          progress: targetNumber > 0 ? base.quantity / targetNumber : 0,
          target: `${formatQuantity(targetNumber)} ${assetSymbol ?? ""}`,
          remainingValue: missing * base.price,
          missing,
        };
      }
      case "target_price":
        return {
          current: money(base.price),
          progress: base.price > 0 && targetNumber > 0 ? (targetNumber >= base.price ? base.price / targetNumber : targetNumber / base.price) : 0,
          target: `${money(targetNumber)} (${formatPercent(base.price > 0 ? ((targetNumber - base.price) / base.price) * 100 : 0)})`,
          remainingValue: 0,
        };
    }
  })();
  const monthsLeft = deadline
    ? Math.max((new Date(`${deadline}T23:59:59`).getTime() - now) / (30.44 * DAY_MS), 1 / 30)
    : null;

  const presets: Array<{ label: string; value: number }> = (() => {
    if (!base) return [];
    switch (kind) {
      case "target_value":
        return [10, 25, 50, 100].map((pct) => {
          const v = Math.round(base.value * (1 + pct / 100));
          return { label: `+${pct}% · ${money(v)}`, value: v };
        });
      case "gain_percent":
        return [5, 10, 20, 50].map((pct) => ({ label: `+${pct}%`, value: pct }));
      case "asset_quantity":
        if (base.quantity > 0) {
          return [1.5, 2, 3].map((m) => {
            const v = roundQty(base.quantity * m);
            return { label: `×${m} · ${formatQuantity(v)}`, value: v };
          });
        }
        return base.price > 0
          ? [100, 500, 1000].map((amount) => {
              const v = roundQty(amount / base.price);
              return { label: `${money(amount)} · ${formatQuantity(v)}`, value: v };
            })
          : [];
      case "target_price":
        return base.price > 0
          ? [-20, -10, 10, 25, 50].map((pct) => {
              const v = Number((base.price * (1 + pct / 100)).toPrecision(5));
              return { label: `${pct > 0 ? "+" : ""}${pct}% · ${money(v)}`, value: v };
            })
          : [];
    }
  })();

  const targetField = (n: number) =>
    kind === "target_value"
      ? { targetValue: n }
      : kind === "gain_percent"
        ? { targetPercent: n }
        : kind === "asset_quantity"
          ? { targetQuantity: n }
          : { targetPrice: n };

  const mutation = useMutation({
    mutationFn: () => {
      const finalName = name.trim() || defaultGoalName(kind, targetNumber, money, assetSymbol);
      if (editing) {
        return updateGoal(editing.id, {
          name: finalName,
          ...targetField(targetNumber),
          deadline: deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null,
        });
      }
      return createGoal(portfolioId, {
        name: finalName,
        kind,
        ...targetField(targetNumber),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59`).toISOString() } : {}),
        ...(assetSymbol ? { assetSymbol } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      onDone();
    },
  });

  const targetLabel =
    kind === "target_value"
      ? `Valor objetivo (${currency})`
      : kind === "gain_percent"
        ? "Ganancia objetivo (%)"
        : kind === "asset_quantity"
          ? `Cantidad objetivo${assetSymbol ? ` (${assetSymbol})` : ""}`
          : `Precio objetivo${assetSymbol ? ` de ${assetSymbol}` : ""} (USDT)`;

  return (
    <Card title={editing ? `Editar “${editing.name}”` : "Nueva meta"}>
      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-4 text-sm">
          {editing ? null : (
            <div role="radiogroup" aria-label="Tipo de meta" className="grid gap-2 sm:grid-cols-2">
              {KINDS.map((k) => (
                <OptionCard
                  key={k.kind}
                  active={kind === k.kind}
                  onClick={() => {
                    setKind(k.kind);
                    setTarget("");
                  }}
                  title={k.title(currency)}
                  description={k.description}
                />
              ))}
            </div>
          )}

          {editing && !editing.assetSymbol ? null : (
          <div className="flex flex-col gap-2">
            <span>{needsAsset || editing ? "Moneda" : "¿De todo el portafolio o de un activo?"}</span>
            {assetSymbol ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">{assetSymbol}</span>
                {editing ? null : (
                  <button type="button" onClick={() => setAssetSymbol(null)} className="text-xs text-text-secondary hover:text-foreground">
                    {needsAsset ? "Cambiar moneda" : "Volver a todo el portafolio"}
                  </button>
                )}
              </div>
            ) : (
              <AssetPicker
                label={needsAsset ? "Elegir la moneda" : "Elegir un activo (opcional)"}
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
          )}

          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              {targetLabel}
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((pr) => (
                <Chip key={pr.label} active={targetNumber === pr.value} onClick={() => setTarget(String(pr.value))}>
                  {pr.label}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            Nombre (opcional)
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={targetNumber > 0 ? defaultGoalName(kind, targetNumber, money, assetSymbol) : "Fondo para 2027"}
            />
          </label>

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
        </div>

        {/* Vista previa en vivo */}
        <aside className="flex flex-col gap-3 rounded-xl border border-border-hairline bg-surface-raised/50 p-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Vista previa</p>
          {needsAsset && !assetSymbol ? (
            <p className="text-text-secondary">Elige la moneda para ver cuánto falta.</p>
          ) : !preview ? (
            <p className="text-text-secondary">Cargando tus números…</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <ProgressRing value={Math.min(1, Math.max(0, preview.progress))} label="Progreso actual hacia la meta" size={64} />
                <div>
                  <p className="text-text-secondary">{assetSymbol ? `Hoy en ${assetSymbol}` : "Hoy"}</p>
                  <p className="font-[family-name:var(--font-mono)] text-base font-semibold tabular-nums">{preview.current}</p>
                </div>
              </div>
              {targetNumber > 0 ? (
                <ul className="space-y-1.5 text-text-secondary">
                  <li>
                    Objetivo: <span className="text-foreground tabular-nums">{preview.target}</span>
                  </li>
                  {kind === "target_price" ? (
                    <li>Se cumple cuando el precio llegue ahí; queda cumplida aunque después vuelva.</li>
                  ) : (
                    <li>
                      Falta:{" "}
                      <span className="text-foreground tabular-nums">
                        {preview.remainingValue > 0 || ("missing" in preview && (preview.missing ?? 0) > 0)
                          ? "missing" in preview
                            ? `${formatQuantity(preview.missing ?? 0)} ${assetSymbol ?? ""} (≈ ${money(preview.remainingValue)})`
                            : money(preview.remainingValue)
                          : "¡ya está cumplida!"}
                      </span>
                    </li>
                  )}
                  {monthsLeft !== null && preview.remainingValue > 0 ? (
                    <li>
                      Ritmo necesario:{" "}
                      <span className="text-foreground tabular-nums">{money(preview.remainingValue / monthsLeft)}</span> por mes
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-text-secondary">Elige un objetivo para ver cuánto falta.</p>
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
            {mutation.isPending ? "Guardando…" : editing ? "Guardar cambios" : "Crear meta"}
          </button>
          <button type="button" onClick={onDone} className="rounded-md border border-border-hairline px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </Card>
  );
}
