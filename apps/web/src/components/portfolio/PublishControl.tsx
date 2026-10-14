"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Portfolio } from "@val-sistem/shared";
import { setPublication } from "@/lib/strategy-client";

// Publicar un portafolio en el ranking de Explorar (opt-in). Se muestra con
// un alias elegido acá; nunca montos, usuario ni email.
export function PublishControl({ portfolio }: { portfolio: Portfolio }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [alias, setAlias] = useState(portfolio.publicAlias ?? portfolio.name);

  const mutation = useMutation({
    mutationFn: (isPublic: boolean) =>
      setPublication(portfolio.id, isPublic ? { isPublic, alias: alias.trim() } : { isPublic }),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      await queryClient.invalidateQueries({ queryKey: ["public-ranking"] });
    },
  });

  if (portfolio.isPublic) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-hairline pt-3 text-sm">
        <span className="text-text-secondary">
          Público como <span className="font-medium text-foreground">“{portfolio.publicAlias}”</span>
        </span>
        <button
          onClick={() => mutation.mutate(false)}
          disabled={mutation.isPending}
          className="text-text-secondary hover:text-foreground disabled:opacity-50"
        >
          Dejar de publicar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border-hairline pt-3 text-sm">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-primary">
          Publicar en el ranking
        </button>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (alias.trim().length >= 3) mutation.mutate(true);
          }}
        >
          <p className="text-text-secondary">
            Otros usuarios van a ver el % de rendimiento y la composición (qué % tiene cada
            activo). Nunca montos, cantidades, tu usuario ni tu email.
          </p>
          <label className="flex flex-col gap-1">
            Nombre público
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={40}
              className="rounded-md border border-border-hairline bg-background px-3 py-2"
            />
          </label>
          {mutation.isError ? <p className="text-status-critical">{mutation.error.message}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={alias.trim().length < 3 || mutation.isPending}
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              Publicar
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-border-hairline px-3 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
