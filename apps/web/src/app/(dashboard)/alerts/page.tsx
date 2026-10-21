"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  alertRuleText,
  formatCurrency,
  NEW_ALERT_KIND_LABELS,
  timeAgo,
  type AlertsOverview,
  type NewAlertKind,
} from "@val-sistem/shared";
import { Card } from "@/components/ui/Card";
import { Chip, OptionCard } from "@/components/ui/Choice";
import { AssetPicker } from "@/components/strategy/AssetPicker";
import {
  createAlert,
  deleteAlert,
  fetchAlerts,
  fetchNotifications,
  markNotificationsRead,
  setAutoAlert,
  updateAlert,
} from "@/lib/alerts-client";
import { fetchPortfolios } from "@/lib/portfolio-client";
import { fetchTickers } from "@/lib/market-client";

const money = (n: number) => formatCurrency(n, "USD");
const inputClass = "rounded-md border border-border-hairline bg-background px-3 py-2";

// Avisos: reglas propias (precio, movimientos, estrategia), avisos
// automáticos (metas y compras) y el historial de notificaciones.
export default function AlertsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-text-secondary">Cargando…</p>}>
      <AlertsContent />
    </Suspense>
  );
}

function AlertsContent() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });
  const setData = (next: AlertsOverview) => queryClient.setQueryData(["alerts"], next);
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateAlert(id, { isActive }),
    onSuccess: setData,
  });
  const remove = useMutation({ mutationFn: deleteAlert, onSuccess: setData });
  const auto = useMutation({
    mutationFn: ({ kind, enabled }: { kind: "goal_events" | "dca_due"; enabled: boolean }) => setAutoAlert(kind, enabled),
    onSuccess: setData,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Avisos</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Te avisamos en la campana de arriba y, si tienes la app en el celular, con una notificación.
          Se revisan cada 5 minutos.
        </p>
      </div>

      <NewAlertForm initialAsset={params.get("asset")} onCreated={setData} />

      <Card title="Tus avisos">
        {isLoading || !data ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : data.rules.length === 0 ? (
          <p className="text-sm text-text-secondary">Todavía no creaste avisos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-hairline">
            {data.rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => toggle.mutate({ id: r.id, isActive: e.target.checked })}
                    aria-label={`Activar: ${alertRuleText(r, money)}`}
                  />
                </label>
                <span className={`flex-1 ${r.isActive ? "" : "text-text-muted line-through"}`}>{alertRuleText(r, money)}</span>
                {r.lastTriggeredAt ? (
                  <span className="text-xs text-text-muted">
                    Último aviso {new Date(r.lastTriggeredAt).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove.mutate(r.id)}
                  className="text-xs text-text-secondary hover:text-status-critical"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Avisos automáticos">
        <div className="flex flex-col gap-3 text-sm">
          <AutoToggle
            title="Metas"
            description="Cuando cumples una meta, llegas a un hito (25, 50 o 75 %) o vas atrasado para la fecha."
            checked={data?.auto.goalEvents ?? true}
            onChange={(enabled) => auto.mutate({ kind: "goal_events", enabled })}
          />
          <AutoToggle
            title="Compras periódicas"
            description="El día que toca una compra de tus planes."
            checked={data?.auto.dcaDue ?? true}
            onChange={(enabled) => auto.mutate({ kind: "dca_due", enabled })}
          />
        </div>
      </Card>

      <NotificationHistory />
    </div>
  );
}

function AutoToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-text-secondary">{description}</span>
      </span>
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const KINDS: Array<{ kind: NewAlertKind; description: string }> = [
  { kind: "price", description: "Ej.: avisarme cuando BTC llegue a 100.000." },
  { kind: "asset_move", description: "Ej.: ETH sube o baja más de 5 % en 24 h." },
  { kind: "portfolio_move", description: "Ej.: mi portafolio se mueve más de 3 % en un día." },
  { kind: "strategy_drift", description: "Ej.: algún activo se aleja 5 puntos de mi estrategia." },
];

function NewAlertForm({
  initialAsset,
  onCreated,
}: {
  initialAsset: string | null;
  onCreated: (o: AlertsOverview) => void;
}) {
  const [kind, setKind] = useState<NewAlertKind>("price");
  const [asset, setAsset] = useState<string | null>(initialAsset);
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [threshold, setThreshold] = useState("");
  const [repeat, setRepeat] = useState(false);
  const needsAsset = kind === "price" || kind === "asset_move";
  const needsPortfolio = kind === "strategy_drift" || kind === "portfolio_move";

  const { data: tickers } = useQuery({ queryKey: ["tickers"], queryFn: () => fetchTickers(), enabled: kind === "price" });
  const { data: portfolios } = useQuery({ queryKey: ["portfolios"], queryFn: fetchPortfolios });
  const price = asset ? tickers?.find((t) => t.assetSymbol === asset)?.price : undefined;
  const value = Number(threshold.replace(",", "."));
  const valid =
    value > 0 && (!needsAsset || !!asset) && (kind !== "strategy_drift" || !!portfolioId);

  const create = useMutation({
    mutationFn: () =>
      createAlert({
        kind,
        threshold: value,
        ...(needsAsset ? { assetSymbol: asset! } : {}),
        ...(needsPortfolio && portfolioId ? { portfolioId } : {}),
        ...(kind === "price" ? { repeat } : {}),
      }),
    onSuccess: (o) => {
      onCreated(o);
      setThreshold("");
    },
  });

  const presets =
    kind === "price"
      ? price
        ? [-20, -10, 10, 20].map((p) => {
            const v = Number((price * (1 + p / 100)).toPrecision(5));
            return { label: `${p > 0 ? "+" : ""}${p}% · ${money(v)}`, value: v };
          })
        : []
      : kind === "strategy_drift"
        ? [3, 5, 10].map((v) => ({ label: `${v} puntos`, value: v }))
        : [3, 5, 10].map((v) => ({ label: `±${v} %`, value: v }));

  return (
    <Card title="Nuevo aviso">
      <form
        className="flex flex-col gap-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <div role="radiogroup" aria-label="Tipo de aviso" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {KINDS.map((k) => (
            <OptionCard
              key={k.kind}
              active={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setThreshold("");
              }}
              title={NEW_ALERT_KIND_LABELS[k.kind]}
              description={k.description}
            />
          ))}
        </div>

        {needsAsset ? (
          <div className="flex flex-col gap-2">
            <span>Moneda</span>
            {asset ? (
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 font-medium text-primary">{asset}</span>
                {price ? <span className="text-text-secondary">hoy {money(price)}</span> : null}
                <button type="button" onClick={() => setAsset(null)} className="text-xs text-text-secondary hover:text-foreground">
                  Cambiar
                </button>
              </div>
            ) : (
              <AssetPicker label="Elegir la moneda" held={[]} exclude={[]} onPick={setAsset} />
            )}
          </div>
        ) : null}

        {needsPortfolio ? (
          <label className="flex flex-col gap-1">
            Portafolio
            <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} className={inputClass}>
              {kind === "portfolio_move" ? <option value="">Todos mis portafolios</option> : <option value="">Elegir…</option>}
              {(portfolios ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            {kind === "price"
              ? "Avisarme cuando llegue a (USDT)"
              : kind === "strategy_drift"
                ? "Desvío máximo (puntos de %)"
                : "Movimiento en 24 h (%)"}
            <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p.label} active={value === p.value} onClick={() => setThreshold(String(p.value))}>
                {p.label}
              </Chip>
            ))}
          </div>
          {kind === "price" && price && value > 0 ? (
            <p className="text-xs text-text-secondary">
              Te avisamos cuando {asset} {value > price ? "suba" : "baje"} hasta {money(value)} (
              {(((value - price) / price) * 100).toFixed(1)} % desde hoy).
            </p>
          ) : null}
        </div>

        {kind === "price" ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            Avisarme cada vez que cruce ese precio (si no, una sola vez)
          </label>
        ) : null}

        {create.isError ? <p className="text-status-critical">{create.error.message}</p> : null}
        <button
          type="submit"
          disabled={!valid || create.isPending}
          className="self-start rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {create.isPending ? "Creando…" : "Crear aviso"}
        </button>
      </form>
    </Card>
  );
}

function NotificationHistory() {
  const queryClient = useQueryClient();
  const [now] = useState(() => Date.now());
  const { data } = useQuery({ queryKey: ["notifications", "history"], queryFn: () => fetchNotifications(100) });
  const markAll = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <Card
      title="Historial"
      action={
        data && data.unreadCount > 0 ? (
          <button type="button" onClick={() => markAll.mutate()} className="text-xs text-primary">
            Marcar todas como leídas
          </button>
        ) : undefined
      }
    >
      {!data || data.items.length === 0 ? (
        <p className="text-sm text-text-secondary">Todavía no recibiste avisos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-hairline">
          {data.items.map((n) => (
            <li key={n.id} className="flex gap-3 py-2.5 text-sm">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className={n.read ? "text-text-secondary" : "font-medium"}>{n.title}</p>
                <p className="text-xs text-text-muted">{n.body}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-text-muted">
                <span>{timeAgo(n.createdAt, now)}</span>
                {n.link ? (
                  <Link href={n.link} className="text-primary">
                    Ver
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
