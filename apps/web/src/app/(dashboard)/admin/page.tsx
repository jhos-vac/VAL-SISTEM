"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  JOB_LABELS,
  JOB_STATE_LABELS,
  type AdminUser,
  type AdminUserStatus,
  type JobState,
} from "@val-sistem/shared";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Segmented } from "@/components/ui/Choice";
import {
  fetchAdminHealth,
  fetchAdminOverview,
  fetchAdminPublicPortfolios,
  fetchAdminUsers,
  setAdminUserStatus,
  unpublishPortfolio,
  useIsAdmin,
} from "@/lib/admin-client";
import { useAuthStore } from "@/store/auth-store";

type Tab = "overview" | "users" | "health" | "public";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "overview", label: "Resumen" },
  { value: "users", label: "Usuarios" },
  { value: "health", label: "Salud" },
  { value: "public", label: "Públicos" },
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short" }) : "—";

function ago(iso: string | null, now: number): string {
  if (!iso) return "nunca";
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

// Panel de administración. El backend exige el rol admin en cada endpoint;
// acá solo se evita mostrarlo a quien no lo tiene.
export default function AdminPage() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  if (!isAdmin) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Esta sección es solo para administradores.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Administración</h1>
        <Segmented label="Sección" value={tab} options={TABS} onChange={setTab} />
      </div>
      {tab === "overview" ? <Overview /> : null}
      {tab === "users" ? <Users /> : null}
      {tab === "health" ? <Health /> : null}
      {tab === "public" ? <PublicPortfolios /> : null}
    </div>
  );
}

function Overview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "overview"], queryFn: fetchAdminOverview });
  if (isLoading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (isError || !data) return <p className="text-sm text-text-secondary">No se pudieron cargar las métricas.</p>;
  const { users, portfolios } = data;
  const max = Math.max(1, ...users.signupsByDay.map((d) => d.count));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Usuarios" value={users.total} delta={`${users.suspended} suspendido(s) · ${users.admins} admin`} accent="primary" />
        <StatTile label="Activos 7 días" value={users.activeLast7Days} delta={`${users.activeLast30Days} en 30 días`} />
        <StatTile label="Altas 30 días" value={users.newLast30Days} delta={`${users.newLast7Days} en 7 días`} />
        <StatTile label="Portafolios" value={portfolios.portfolios} delta={`${portfolios.publicPortfolios} públicos · ${portfolios.copies} copias`} />
        <StatTile label="Transacciones" value={portfolios.transactions} delta={`${portfolios.transactionsLast30Days} en 30 días`} />
        <StatTile label="Cuentas Binance" value={portfolios.exchangeAccounts} delta={`${portfolios.exchangeAccountsSyncing} sincronizando`} />
        <StatTile label="Metas" value={portfolios.goals} />
        <StatTile label="Planes DCA activos" value={portfolios.activeDcaPlans} />
      </div>
      <Card title="Altas por día (30 días)">
        <div className="flex h-32 items-end gap-1" role="img" aria-label="Altas de usuarios por día en los últimos 30 días">
          {users.signupsByDay.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(d.count > 0 ? 6 : 2, (d.count / max) * 100)}%`, opacity: d.count > 0 ? 1 : 0.25 }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface-raised px-1.5 py-0.5 text-xs group-hover:block">
                {d.date.slice(5)}: {d.count}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Users() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminUserStatus | "">("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "users", search, status, page],
    queryFn: () => fetchAdminUsers({ search: search.trim() || undefined, status, page }),
    placeholderData: keepPreviousData,
  });
  const change = useMutation({
    mutationFn: ({ user, next }: { user: AdminUser; next: AdminUserStatus }) => setAdminUserStatus(user.id, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const [now] = useState(() => Date.now());

  const toggle = (user: AdminUser) => {
    const next: AdminUserStatus = user.status === "Suspended" ? "Active" : "Suspended";
    const msg =
      next === "Suspended"
        ? `¿Suspender a ${user.email}? Se cierran todas sus sesiones y no podrá entrar.`
        : `¿Reactivar a ${user.email}?`;
    if (window.confirm(msg)) change.mutate({ user, next });
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar por email, usuario o nombre"
          className="w-72 rounded-md border border-border-hairline bg-background px-2 py-1"
          aria-label="Buscar usuarios"
        />
        <Segmented
          label="Estado"
          value={status === "" ? "all" : status}
          options={[
            { value: "all", label: "Todos" },
            { value: "Active", label: "Activos" },
            { value: "Suspended", label: "Suspendidos" },
          ]}
          onChange={(v) => {
            setStatus(v === "all" ? "" : (v as AdminUserStatus));
            setPage(1);
          }}
        />
        {data ? <span className="ml-auto text-text-secondary">{data.total} usuario(s)</span> : null}
      </div>
      {change.isError ? <p className="mb-2 text-sm text-status-critical">{change.error.message}</p> : null}
      {isLoading ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : isError || !data ? (
        <p className="text-sm text-text-secondary">No se pudo cargar la lista.</p>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sin resultados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2 font-normal">Usuario</th>
                <th className="py-2 font-normal">Estado</th>
                <th className="py-2 font-normal">Alta</th>
                <th className="py-2 font-normal">Último acceso</th>
                <th className="py-2 text-right font-normal">Portafolios</th>
                <th className="py-2 text-right font-normal">Binance</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} className="border-t border-border-hairline">
                  <td className="py-2">
                    <div className="font-medium">
                      {u.firstName} {u.lastName}
                      {u.roles.includes("admin") ? (
                        <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-xs text-primary">admin</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {u.email} · @{u.username}
                    </div>
                  </td>
                  <td className="py-2">
                    <span className={u.status === "Active" ? "text-status-good" : "text-status-critical"}>
                      {u.status === "Active" ? "Activo" : "Suspendido"}
                    </span>
                  </td>
                  <td className="py-2 tabular-nums">{new Date(u.createdAt).toLocaleDateString("es-EC")}</td>
                  <td className="py-2">{ago(u.lastLoginAt, now)}</td>
                  <td className="py-2 text-right tabular-nums">{u.portfolios}</td>
                  <td className="py-2 text-right tabular-nums">{u.exchangeAccounts}</td>
                  <td className="py-2 text-right">
                    {u.id === me?.id ? (
                      <span className="text-xs text-text-muted">vos</span>
                    ) : (
                      <button
                        onClick={() => toggle(u)}
                        disabled={change.isPending}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          u.status === "Suspended"
                            ? "border-status-good text-status-good"
                            : "border-status-critical text-status-critical"
                        }`}
                      >
                        {u.status === "Suspended" ? "Reactivar" : "Suspender"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-md border border-border-hairline px-2 py-1 disabled:opacity-40">
            Anterior
          </button>
          <span className="text-text-secondary">
            {page} / {pages}
          </span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-md border border-border-hairline px-2 py-1 disabled:opacity-40">
            Siguiente
          </button>
        </div>
      ) : null}
    </Card>
  );
}

const STATE_STYLE: Record<JobState, string> = {
  ok: "bg-status-good/15 text-status-good",
  failed: "bg-status-critical/15 text-status-critical",
  late: "bg-status-warning/15 text-status-warning",
  never: "bg-surface-raised text-text-secondary",
};

function Health() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "health"],
    queryFn: fetchAdminHealth,
    refetchInterval: 30_000,
  });
  if (isLoading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (isError || !data) return <p className="text-sm text-text-secondary">No se pudo consultar la salud del sistema.</p>;
  const now = new Date(data.checkedAt).getTime();
  const priceAgeMin = data.market.lastUpdatedAt ? (now - new Date(data.market.lastUpdatedAt).getTime()) / 60_000 : null;
  const errorRate = data.failures.total24h > 0 ? (data.failures.failed24h / data.failures.total24h) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Precios"
          value={ago(data.market.lastUpdatedAt, now)}
          delta={`${data.market.tickers} mercados`}
          accent={priceAgeMin !== null && priceAgeMin <= 15 ? "gain" : "loss"}
        />
        <StatTile
          label="Jobs con problemas"
          value={data.jobs.filter((j) => j.state === "failed" || j.state === "late").length}
          delta={`de ${data.jobs.length}`}
          accent={data.jobs.some((j) => j.state === "failed" || j.state === "late") ? "loss" : "gain"}
        />
        <StatTile
          label="Errores 24 h"
          value={data.failures.failed24h}
          delta={`${errorRate.toFixed(1)} % de ${data.failures.total24h} acciones`}
        />
        <StatTile label="Servidor activo" value={`${Math.floor(data.uptimeSeconds / 3600)} h`} delta={`${Math.floor((data.uptimeSeconds % 3600) / 60)} min`} />
      </div>
      <Card
        title="Jobs programados"
        action={
          <button onClick={() => void refetch()} className="text-xs text-primary" disabled={isFetching}>
            {isFetching ? "Actualizando…" : "Actualizar"}
          </button>
        }
      >
        <div className="flex flex-col divide-y divide-border-hairline">
          {data.jobs.map((j) => (
            <div key={j.name} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_STYLE[j.state]}`}>{JOB_STATE_LABELS[j.state]}</span>
              <span className="font-medium">{JOB_LABELS[j.name] ?? j.name}</span>
              <span className="text-text-secondary">cada {Math.round(j.everyMs / 60_000)} min</span>
              <span className="ml-auto text-text-secondary">
                {ago(j.lastFinishedAt, now)}
                {j.lastDurationMs !== null ? ` · ${(j.lastDurationMs / 1000).toFixed(1)} s` : ""}
              </span>
              {j.lastError ? <p className="w-full text-xs text-status-critical">{j.lastError}</p> : null}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Acciones fallidas (24 h)">
        {data.failures.items.length === 0 ? (
          <p className="text-sm text-text-secondary">Ninguna.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <tbody>
                {data.failures.items.map((f, i) => (
                  <tr key={i} className="border-t border-border-hairline first:border-t-0">
                    <td className="py-1.5 whitespace-nowrap text-text-secondary">{fmtDate(f.createdAt)}</td>
                    <td className="py-1.5 font-mono text-xs">
                      {f.method} {f.path}
                    </td>
                    <td className="py-1.5 text-text-secondary">{f.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function PublicPortfolios() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "public"],
    queryFn: fetchAdminPublicPortfolios,
  });
  const unpublish = useMutation({
    mutationFn: unpublishPortfolio,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["public-ranking"] });
    },
  });

  if (isLoading) return <p className="text-sm text-text-secondary">Cargando…</p>;
  if (isError || !data) return <p className="text-sm text-text-secondary">No se pudo cargar la lista.</p>;

  return (
    <Card title={`Portafolios publicados (${data.length})`}>
      {unpublish.isError ? <p className="mb-2 text-sm text-status-critical">{unpublish.error.message}</p> : null}
      {data.length === 0 ? (
        <p className="text-sm text-text-secondary">No hay portafolios públicos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-2 font-normal">Alias público</th>
                <th className="py-2 font-normal">Dueño</th>
                <th className="py-2 font-normal">Publicado</th>
                <th className="py-2 text-right font-normal">Copias</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-t border-border-hairline">
                  <td className="py-2">
                    <div className="font-medium">{p.alias ?? "—"}</div>
                    <div className="text-xs text-text-secondary">{p.name}</div>
                  </td>
                  <td className="py-2 text-text-secondary">{p.ownerEmail ?? "—"}</td>
                  <td className="py-2">{fmtDate(p.publishedAt)}</td>
                  <td className="py-2 text-right tabular-nums">{p.copies}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Despublicar "${p.alias ?? p.name}"? Sale del ranking y el dueño tendrá que elegir otro alias.`)) {
                          unpublish.mutate(p.id);
                        }
                      }}
                      disabled={unpublish.isPending}
                      className="rounded-md border border-status-critical px-2 py-1 text-xs text-status-critical"
                    >
                      Despublicar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
