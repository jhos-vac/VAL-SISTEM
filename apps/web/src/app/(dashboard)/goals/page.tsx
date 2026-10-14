"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  formatCurrency,
  formatPercent,
  GOAL_STATUS_LABELS,
  type Goal,
  type GoalKind,
} from "@val-sistem/shared";
import { createGoal, deleteGoal, fetchGoals } from "@/lib/strategy-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Metas</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Valor a alcanzar o % de ganancia, con su progreso y el ritmo necesario.
          </p>
        </div>
        {!isAggregate && portfolio ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
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
      ) : goals.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Todavía no tenés metas. Por ejemplo: “llegar a 10.000 USD antes de diciembre” o “+10 %
            en BTC”.
          </p>
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

function GoalCard({
  goal,
  currency,
  onDelete,
}: {
  goal: Goal;
  currency: string;
  onDelete: () => void;
}) {
  const money = (n: number) => formatCurrency(n, currency);
  const p = goal.progress;
  const isValue = goal.kind === "target_value";
  const tone = p.status === "achieved" ? "good" : p.status === "expired" ? "critical" : "primary";

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{goal.name || (isValue ? "Valor objetivo" : "% de ganancia")}</p>
          <p className="text-sm text-text-secondary">
            {goal.assetSymbol ? `${goal.assetSymbol} · ` : ""}
            {isValue
              ? `Llegar a ${money(goal.targetValue ?? 0)}`
              : `Ganar ${formatPercent(goal.targetPercent ?? 0)}`}
            {goal.deadline ? ` antes del ${new Date(goal.deadline).toLocaleDateString("es-EC")}` : ""}
          </p>
        </div>
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

      <div className="mt-4 flex flex-col gap-2">
        <ProgressBar value={p.progress} label={`Progreso de ${goal.name}`} tone={tone} />
        <div className="flex justify-between text-sm tabular-nums">
          <span>{isValue ? money(p.current) : formatPercent(p.current)}</span>
          <span className="text-text-secondary">
            {Math.round(p.progress * 100)}% de {isValue ? money(p.target) : formatPercent(p.target)}
          </span>
        </div>
      </div>

      {p.status === "in_progress" ? (
        <ul className="mt-3 space-y-1 text-sm text-text-secondary">
          <li>
            Falta: <span className="tabular-nums text-foreground">{money(p.remainingValue)}</span>
            {!isValue ? ` (valor objetivo ${money(p.targetValueEquivalent)})` : ""}
          </li>
          {p.daysLeft !== null ? (
            <li>
              Quedan {p.daysLeft} día(s)
              {p.neededPerMonth !== null ? (
                <>
                  {" "}· hace falta crecer{" "}
                  <span className="tabular-nums text-foreground">{money(p.neededPerMonth)}</span> por
                  mes
                </>
              ) : null}
            </li>
          ) : null}
        </ul>
      ) : null}

      <button
        onClick={onDelete}
        className="mt-3 text-xs text-text-secondary hover:text-status-critical"
      >
        Eliminar meta
      </button>
    </Card>
  );
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
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GoalKind>("target_value");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assetSymbol, setAssetSymbol] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const value = Number(target.replace(",", "."));
      return createGoal(portfolioId, {
        name: name.trim(),
        kind,
        ...(kind === "target_value" ? { targetValue: value } : { targetPercent: value }),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59`).toISOString() } : {}),
        ...(assetSymbol.trim() ? { assetSymbol: assetSymbol.trim().toUpperCase() } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      onDone();
    },
  });

  const valid = name.trim().length > 0 && Number(target.replace(",", ".")) > 0;

  return (
    <Card title="Nueva meta">
      <form
        className="grid max-w-lg gap-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutation.mutate();
        }}
      >
        <label className="flex flex-col gap-1">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Fondo para 2027" />
        </label>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1">Tipo</legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={kind === "target_value"} onChange={() => setKind("target_value")} />
            Valor a alcanzar ({currency})
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={kind === "gain_percent"} onChange={() => setKind("gain_percent")} />
            % de ganancia
          </label>
        </fieldset>
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
        <label className="flex flex-col gap-1">
          Fecha límite (opcional)
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          Solo un activo (opcional)
          <input
            value={assetSymbol}
            onChange={(e) => setAssetSymbol(e.target.value)}
            className={`${inputClass} uppercase`}
            placeholder="BTC — vacío = todo el portafolio"
          />
        </label>
        {mutation.isError ? <p className="text-status-critical">{mutation.error.message}</p> : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!valid || mutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-white disabled:opacity-50"
          >
            Crear meta
          </button>
          <button type="button" onClick={onDone} className="rounded-md border border-border-hairline px-3 py-1.5">
            Cancelar
          </button>
        </div>
      </form>
    </Card>
  );
}
