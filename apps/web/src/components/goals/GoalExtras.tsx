"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GOAL_MILESTONES,
  suggestedPlan,
  type Goal,
} from "@val-sistem/shared";
import { AssetPicker } from "@/components/strategy/AssetPicker";
import { createDcaPlan } from "@/lib/strategy-client";

const TONE_STROKE = {
  good: "stroke-status-good",
  critical: "stroke-status-critical",
  primary: "stroke-primary",
} as const;

// Línea de lo que mide la meta en los últimos 90 días, con el objetivo
// punteado. Se dibuja solo si hay al menos dos días.
export function GoalSparkline({
  goal,
  tone,
  format,
}: {
  goal: Goal;
  tone: keyof typeof TONE_STROKE;
  format: (n: number) => string;
}) {
  const points = goal.history;
  if (points.length < 2) return null;
  const W = 300;
  const H = 64;
  const target = goal.progress.target;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, target);
  const max = Math.max(...values, target);
  const span = max - min || 1;
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const first = points[0]!;

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Evolución desde ${new Date(first.date).toLocaleDateString("es-EC")}: de ${format(first.value)} a ${format(points[points.length - 1]!.value)}. Objetivo ${format(target)}.`}
      >
        <line
          x1={0}
          x2={W}
          y1={y(target)}
          y2={y(target)}
          className="stroke-text-muted"
          strokeDasharray="4 4"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path d={path} fill="none" className={TONE_STROKE[tone]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex justify-between text-[11px] text-text-muted">
        <span>{new Date(first.date).toLocaleDateString("es-EC", { day: "numeric", month: "short" })}</span>
        <span>Objetivo {format(target)} (punteado)</span>
        <span>Hoy</span>
      </figcaption>
    </figure>
  );
}

// Hitos de 25, 50 y 75 %: se marcan los alcanzados.
export function GoalMilestones({ goal }: { goal: Goal }) {
  const progress = goal.progress.progress;
  return (
    <ol className="flex items-center gap-2 text-[11px]" aria-label="Hitos de la meta">
      {GOAL_MILESTONES.map((m) => {
        const reached = progress >= m;
        return (
          <li
            key={m}
            className={`rounded-full px-2 py-0.5 tabular-nums ${
              reached ? "bg-status-good/15 text-status-good" : "bg-surface-raised text-text-muted"
            }`}
          >
            {reached ? "✓ " : ""}
            {Math.round(m * 100)}%
          </li>
        );
      })}
    </ol>
  );
}

// Plan de compras semanal sugerido para llegar a la fecha, con un botón que
// lo crea (hasta la fecha límite). Si la meta no es de una moneda, primero
// se elige en qué comprar.
export function GoalPlanSuggestion({
  goal,
  money,
}: {
  goal: Goal;
  money: (n: number) => string;
}) {
  const queryClient = useQueryClient();
  const plan = suggestedPlan(goal);
  const [picking, setPicking] = useState(false);
  const create = useMutation({
    mutationFn: (assetSymbol: string) =>
      createDcaPlan(goal.portfolioId, {
        assetSymbol,
        amount: plan!.amountPerWeek,
        frequency: "weekly",
        startDate: new Date().toISOString(),
        endDate: plan!.endDate,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dca-plans"] }),
  });
  if (!plan) return null;

  if (create.isSuccess) {
    return (
      <p className="rounded-lg bg-status-good/10 px-3 py-2 text-xs text-status-good">
        Plan creado: {money(plan.amountPerWeek)} por semana de {create.variables}.{" "}
        <Link href="/strategy" className="underline">
          Verlo en Estrategia
        </Link>
      </p>
    );
  }

  const confirmAndCreate = (symbol: string) => {
    if (
      window.confirm(
        `¿Crear un plan de ${money(plan.amountPerWeek)} por semana de ${symbol} hasta el ${new Date(plan.endDate).toLocaleDateString("es-EC")} (${plan.purchases} compras)?`,
      )
    ) {
      create.mutate(symbol);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-hairline px-3 py-2 text-xs">
      <p className="text-text-secondary">
        Para llegar a tiempo:{" "}
        <span className="font-medium text-foreground">{money(plan.amountPerWeek)} por semana</span> durante{" "}
        {plan.purchases} semana(s), sin contar lo que suba o baje el mercado.
      </p>
      {picking ? (
        <AssetPicker
          label="¿En qué moneda?"
          held={[]}
          exclude={[]}
          onPick={(symbol) => {
            setPicking(false);
            confirmAndCreate(symbol);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => (goal.assetSymbol ? confirmAndCreate(goal.assetSymbol) : setPicking(true))}
          disabled={create.isPending}
          className="self-start rounded-md bg-primary-soft px-2.5 py-1 font-medium text-primary disabled:opacity-50"
        >
          {create.isPending ? "Creando…" : "Crear este plan de compras"}
        </button>
      )}
      {create.isError ? <p className="text-status-critical">{create.error.message}</p> : null}
    </div>
  );
}
