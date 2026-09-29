"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import {
  createPortfolio,
  fetchPortfolios,
  getOrCreateDefaultWallet,
  setDefaultPortfolio,
  updatePortfolio,
} from "@/lib/portfolio-client";
import type { Portfolio } from "@val-sistem/shared";

// RFW-03: crear, editar, marcar predeterminado, cambiar entre
// portafolios. "Cambiar entre portafolios" vive en el selector del
// Topbar (ver usePortfolioSelectionStore) — acá quedan crear, editar y
// marcar predeterminado.
const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(80),
  baseCurrency: z.string().min(3, "Ej: USD").max(10),
});
type FormValues = z.infer<typeof schema>;

export default function PortfoliosPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: portfolios, isLoading, isError } = useQuery({
    queryKey: ["portfolios"],
    queryFn: fetchPortfolios,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { baseCurrency: "USD" },
  });

  const editForm = useForm<FormValues>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const portfolio = await createPortfolio(values);
      // Cada portafolio necesita al menos una wallet para poder registrar
      // transacciones — se crea una "Principal" de una vez, invisible
      // para el usuario en este punto del MVP (ver portfolio-client.ts).
      await getOrCreateDefaultWallet(portfolio.id);
      return portfolio;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      reset();
      setShowForm(false);
    },
  });

  const defaultMutation = useMutation({
    mutationFn: setDefaultPortfolio,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });

  const editMutation = useMutation({
    mutationFn: (values: FormValues & { id: string }) =>
      updatePortfolio(values.id, { name: values.name, baseCurrency: values.baseCurrency }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      setEditingId(null);
    },
  });

  function startEdit(p: Portfolio) {
    setEditingId(p.id);
    editForm.reset({ name: p.name, baseCurrency: p.baseCurrency });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Portafolios</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Nuevo portafolio
        </button>
      </div>

      {showForm ? (
        <Card>
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="grid max-w-sm gap-3"
          >
            <label className="flex flex-col gap-1 text-sm">
              Nombre
              <input
                {...register("name")}
                placeholder="Principal"
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.name ? (
                <span className="text-xs text-status-critical">{errors.name.message}</span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Moneda base
              <input
                {...register("baseCurrency")}
                placeholder="USD"
                className="rounded-md border border-border-hairline bg-background px-3 py-2 uppercase"
              />
              {errors.baseCurrency ? (
                <span className="text-xs text-status-critical">{errors.baseCurrency.message}</span>
              ) : null}
            </label>
            {createMutation.isError ? (
              <p className="text-sm text-status-critical">No se pudo crear el portafolio.</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting || createMutation.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Crear
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-border-hairline px-3 py-1.5 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Cargando portafolios…</p>
      ) : isError ? (
        <p className="text-sm text-text-secondary">No se pudieron cargar los portafolios.</p>
      ) : !portfolios || portfolios.length === 0 ? (
        <Card>
          <p className="text-sm text-text-secondary">
            Todavía no tenés portafolios. Creá el primero para empezar a registrar tus inversiones.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {portfolios.map((p) =>
            editingId === p.id ? (
              <Card key={p.id}>
                <form
                  onSubmit={editForm.handleSubmit((values) =>
                    editMutation.mutate({ ...values, id: p.id }),
                  )}
                  className="grid gap-3"
                >
                  <label className="flex flex-col gap-1 text-sm">
                    Nombre
                    <input
                      {...editForm.register("name")}
                      className="rounded-md border border-border-hairline bg-background px-3 py-2"
                    />
                    {editForm.formState.errors.name ? (
                      <span className="text-xs text-status-critical">
                        {editForm.formState.errors.name.message}
                      </span>
                    ) : null}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Moneda base
                    <input
                      {...editForm.register("baseCurrency")}
                      className="rounded-md border border-border-hairline bg-background px-3 py-2 uppercase"
                    />
                    {editForm.formState.errors.baseCurrency ? (
                      <span className="text-xs text-status-critical">
                        {editForm.formState.errors.baseCurrency.message}
                      </span>
                    ) : null}
                  </label>
                  {editMutation.isError ? (
                    <p className="text-sm text-status-critical">No se pudieron guardar los cambios.</p>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={editMutation.isPending}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-border-hairline px-3 py-1.5 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-text-secondary">Moneda base: {p.baseCurrency}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.isDefault ? (
                      <span className="rounded-full bg-status-good/10 px-2 py-0.5 text-xs font-medium text-status-good">
                        Predeterminado
                      </span>
                    ) : (
                      <button
                        onClick={() => defaultMutation.mutate(p.id)}
                        disabled={defaultMutation.isPending}
                        className="text-sm text-primary disabled:opacity-50"
                      >
                        Marcar predeterminado
                      </button>
                    )}
                    <button onClick={() => startEdit(p)} className="text-sm text-text-secondary hover:text-foreground">
                      Editar
                    </button>
                  </div>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
