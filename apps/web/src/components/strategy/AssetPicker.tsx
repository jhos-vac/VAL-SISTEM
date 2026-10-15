"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAssets } from "@/lib/market-client";
import { fetchCapitalAssets } from "@/lib/portfolio-client";

export interface HeldAsset {
  symbol: string;
  currentPercent: number;
}

// Selector de activos: primero los que el usuario tiene (con su % actual),
// después el resto del catálogo, con buscador. Los ya elegidos no aparecen.
// El panel se abre dentro del flujo (no flotante) porque las tarjetas
// recortan lo que se sale de ellas.
export function AssetPicker({
  held,
  exclude,
  onPick,
  disabled = false,
  label = "Agregar activo",
}: {
  held: HeldAsset[];
  exclude: string[];
  onPick: (symbol: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: catalog } = useQuery({
    queryKey: ["market-assets"],
    queryFn: fetchAssets,
    staleTime: 10 * 60 * 1000,
  });

  // Cerrar al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Las monedas capital (p.ej. USDT) no son inversiones: no se ofrecen.
  const { data: capital } = useQuery({
    queryKey: ["capital-assets"],
    queryFn: fetchCapitalAssets,
  });

  const q = query.trim().toLowerCase();
  const excluded = useMemo(
    () => new Set([...exclude, ...(capital ?? [])]),
    [exclude, capital],
  );
  const names = useMemo(
    () => new Map((catalog ?? []).map((a) => [a.symbol, a.name])),
    [catalog],
  );
  const matches = (symbol: string) =>
    !q || symbol.toLowerCase().includes(q) || (names.get(symbol) ?? "").toLowerCase().includes(q);

  const heldOptions = held.filter((h) => !excluded.has(h.symbol) && matches(h.symbol));
  const heldSet = new Set(held.map((h) => h.symbol));
  const otherOptions = (catalog ?? [])
    .filter((a) => !excluded.has(a.symbol) && !heldSet.has(a.symbol) && matches(a.symbol))
    .slice(0, 50);

  function pick(symbol: string) {
    onPick(symbol);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/60 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden="true" className="text-base leading-none">+</span>
        {label}
      </button>

      {open ? (
        <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-border-hairline bg-surface-raised shadow-lg">
          <div className="border-b border-border-hairline p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar moneda…"
              aria-label="Buscar moneda"
              className="w-full rounded-md border border-border-hairline bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div role="listbox" aria-label="Activos" className="max-h-72 overflow-y-auto py-1 text-sm">
            {heldOptions.length > 0 ? (
              <Section title="Tus activos">
                {heldOptions.map((h) => (
                  <Option key={h.symbol} onClick={() => pick(h.symbol)}>
                    <span className="font-medium">{h.symbol}</span>
                    <span className="text-xs text-text-secondary">
                      hoy {h.currentPercent.toFixed(1)} %
                    </span>
                  </Option>
                ))}
              </Section>
            ) : null}
            {otherOptions.length > 0 ? (
              <Section title="Otras monedas">
                {otherOptions.map((a) => (
                  <Option key={a.symbol} onClick={() => pick(a.symbol)}>
                    <span className="font-medium">{a.symbol}</span>
                    <span className="truncate text-xs text-text-secondary">{a.name}</span>
                  </Option>
                ))}
              </Section>
            ) : null}
            {heldOptions.length === 0 && otherOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-text-secondary">
                {catalog ? "No hay coincidencias." : "Cargando monedas…"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

function Option({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-primary-soft focus:bg-primary-soft focus:outline-none"
    >
      {children}
    </button>
  );
}
