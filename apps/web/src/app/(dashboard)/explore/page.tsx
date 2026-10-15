"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { PnlValue } from "@/components/ui/PnlValue";
import { CATEGORICAL } from "@/lib/chart-colors";
import type { PublicPortfolio } from "@val-sistem/shared";
import { copyPublicPortfolio, fetchPublicRanking } from "@/lib/strategy-client";
import { usePortfolioSelectionStore } from "@/store/portfolio-selection-store";

// Ranking de portafolios públicos (sus dueños los publicaron). Solo se ven
// porcentajes: rendimiento y composición, nunca montos. Copiar crea un
// portafolio tuyo con esa composición como asignación objetivo.
export default function ExplorePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: ranking, isLoading, isError } = useQuery({
    queryKey: ["public-ranking"],
    queryFn: fetchPublicRanking,
  });
  const selected = ranking?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Explorar portafolios</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Los portafolios con mejor rendimiento sobre lo invertido. Elegí uno para ver su
          composición y copiarla como estrategia.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Cargando…</p>
      ) : isError ? (
        <p className="text-sm text-text-secondary">No se pudo cargar el ranking.</p>
      ) : !ranking || ranking.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Todavía no hay portafolios públicos. Podés publicar uno tuyo desde Portafolios.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-text-secondary">
                    <th className="py-2 font-normal">#</th>
                    <th className="py-2 font-normal">Portafolio</th>
                    <th className="py-2 text-right font-normal">Rendimiento</th>
                    <th className="py-2 text-right font-normal">24 h</th>
                    <th className="py-2 text-right font-normal">Activos</th>
                    <th className="py-2 text-right font-normal">Copias</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-t border-border-hairline ${
                        p.id === selectedId ? "bg-primary-soft" : ""
                      }`}
                    >
                      <td className="py-2 tabular-nums text-text-secondary">{i + 1}</td>
                      <td className="py-2">
                        <button
                          onClick={() => setSelectedId(p.id)}
                          className="font-medium text-primary hover:underline"
                          aria-pressed={p.id === selectedId}
                        >
                          {p.alias}
                        </button>
                      </td>
                      <td className="py-2 text-right">
                        <PnlValue value={p.returnPercent} asPercent />
                      </td>
                      <td className="py-2 text-right">
                        <PnlValue value={p.changePercent24h} asPercent />
                      </td>
                      <td className="py-2 text-right tabular-nums">{p.assetsCount}</td>
                      <td className="py-2 text-right tabular-nums">{p.copies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {selected ? (
            <PublicDetail portfolio={selected} />
          ) : (
            <Card>
              <p className="text-sm text-text-secondary">Elegí un portafolio del ranking.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PublicDetail({ portfolio }: { portfolio: PublicPortfolio }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setActive = usePortfolioSelectionStore((s) => s.setActivePortfolioId);
  const [name, setName] = useState(`Copia de ${portfolio.alias}`);

  const copy = useMutation({
    mutationFn: () => copyPublicPortfolio(portfolio.id, name.trim()),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setActive(created.id);
      router.push("/strategy");
    },
  });

  return (
    <Card title={portfolio.alias}>
      <p className="text-sm text-text-secondary">
        Publicado el {new Date(portfolio.publishedAt).toLocaleDateString("es-EC")} ·{" "}
        {portfolio.assetsCount} activo(s)
      </p>

      <div
        className="mt-4 flex h-3 w-full overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {portfolio.composition.map((c, i) => (
          <div
            key={c.assetId}
            style={{
              width: `${c.percent}%`,
              backgroundColor: CATEGORICAL[i % CATEGORICAL.length],
            }}
          />
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Composición de {portfolio.alias}</caption>
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="py-1.5 font-normal">Activo</th>
            <th className="py-1.5 text-right font-normal">Peso</th>
            <th className="py-1.5 text-right font-normal">Rendimiento</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.composition.map((c, i) => (
            <tr key={c.assetId} className="border-t border-border-hairline">
              <td className="py-1.5">
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: CATEGORICAL[i % CATEGORICAL.length] }}
                  aria-hidden="true"
                />
                {c.assetSymbol}
              </td>
              <td className="py-1.5 text-right tabular-nums">{c.percent.toFixed(1)} %</td>
              <td className="py-1.5 text-right">
                {c.returnPercent === null ? "—" : <PnlValue value={c.returnPercent} asPercent />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        className="mt-4 flex flex-col gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length >= 2) copy.mutate();
        }}
      >
        <label className="flex flex-col gap-1">
          Nombre de tu copia
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border-hairline bg-background px-3 py-2"
          />
        </label>
        <p className="text-xs text-text-muted">
          Se crea un portafolio nuevo y vacío con esta composición como asignación objetivo. En
          Estrategia vas a ver qué comprar para replicarla.
        </p>
        {copy.isError ? <p className="text-status-critical">{copy.error.message}</p> : null}
        <button
          type="submit"
          disabled={name.trim().length < 2 || copy.isPending}
          className="self-start rounded-md bg-primary px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {copy.isPending ? "Copiando…" : "Copiar composición"}
        </button>
      </form>
    </Card>
  );
}
