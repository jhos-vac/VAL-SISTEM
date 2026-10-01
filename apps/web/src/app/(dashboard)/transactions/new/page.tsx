"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { createTransaction, getOrCreateDefaultWallet } from "@/lib/portfolio-client";
import { useDefaultPortfolio } from "@/hooks/useDefaultPortfolio";

// RFW-08: registrar operación manual de compra/venta — cubre "controlar
// compras y ventas" en el modelo de trackeo del MVP (ver
// Especificacion_Web_Movil_MVP.md §3, opción A). Ya habla con
// POST /transactions. El concepto de "wallet" queda oculto: se resuelve
// (o se crea) la wallet "Principal" del portafolio activo automáticamente.
const schema = z.object({
  assetSymbol: z.string().min(1, "Elige un activo"),
  type: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().positive("Debe ser mayor a 0"),
  price: z.coerce.number().positive("Debe ser mayor a 0"),
  fee: z.coerce.number().min(0, "No puede ser negativa").default(0),
  executedAt: z.string().min(1, "Elige una fecha"),
  notes: z.string().optional(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function NewTransactionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { portfolio, hasNone, isAggregate, isLoading: loadingPortfolio } = useDefaultPortfolio();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { type: "buy", fee: 0 },
  });

  async function onSubmit(values: FormOutput) {
    if (!portfolio || isAggregate) return;
    setSubmitError(null);
    try {
      const wallet = await getOrCreateDefaultWallet(portfolio.id);
      await createTransaction({
        walletId: wallet.id,
        assetSymbol: values.assetSymbol.toUpperCase(),
        type: values.type,
        quantity: values.quantity,
        price: values.price,
        fee: values.fee,
        notes: values.notes,
        // <input type="date"> da "YYYY-MM-DD" — se completa a ISO 8601.
        executedAt: new Date(values.executedAt).toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      await queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["portfolio-allocation"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      router.push("/transactions");
    } catch {
      setSubmitError(
        "No se pudo registrar la operación. Verificá que el activo exista en el catálogo de Mercado.",
      );
    }
  }

  if (loadingPortfolio) {
    return <p className="text-sm text-text-secondary">Cargando…</p>;
  }

  if (hasNone || !portfolio) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          Creá un portafolio antes de registrar una operación.
        </p>
      </Card>
    );
  }

  if (isAggregate) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">
          La vista General solo muestra el total de todos tus portafolios. Elegí un
          portafolio específico en el selector de arriba para registrar una operación.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Registrar operación manual</h1>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="grid max-w-lg gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Activo
              <input
                {...register("assetSymbol")}
                placeholder="BTC"
                className="rounded-md border border-border-hairline bg-background px-3 py-2 uppercase"
              />
              {errors.assetSymbol ? (
                <span className="text-xs text-status-critical">{errors.assetSymbol.message}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Tipo
              <select
                {...register("type")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              >
                <option value="buy">Compra</option>
                <option value="sell">Venta</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Cantidad
              <input
                type="number"
                step="any"
                {...register("quantity")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.quantity ? (
                <span className="text-xs text-status-critical">{errors.quantity.message}</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Precio (unitario)
              <input
                type="number"
                step="any"
                {...register("price")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.price ? (
                <span className="text-xs text-status-critical">{errors.price.message}</span>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Comisión
              <input
                type="number"
                step="any"
                {...register("fee")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Fecha
              <input
                type="date"
                {...register("executedAt")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.executedAt ? (
                <span className="text-xs text-status-critical">{errors.executedAt.message}</span>
              ) : null}
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            Notas (opcional)
            <textarea
              {...register("notes")}
              rows={2}
              className="rounded-md border border-border-hairline bg-background px-3 py-2"
            />
          </label>

          {submitError ? <p className="text-sm text-status-critical">{submitError}</p> : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar operación
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-border-hairline px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
