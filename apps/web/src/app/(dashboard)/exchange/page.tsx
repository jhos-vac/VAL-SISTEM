"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/Card";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { maskApiKey } from "@val-sistem/shared";
import {
  connectExchangeAccount,
  disconnectExchangeAccount,
  fetchExchangeAccounts,
  syncExchangeAccount,
  type ConnectExchangeAccountResponse,
} from "@/lib/exchange-client";

// RFW-05: alta de cuenta de Binance (solo lectura en el MVP — ver
// Especificacion_Web_Movil_MVP.md §3) con un asistente de 3 pasos en vez
// de un formulario suelto — se investigó conectar sin pedir API key
// (Binance Login/OAuth2) pero está restringido a partners aprobados del
// ecosistema, no es una opción para esta app (ver
// Estado_Backend_VAL-BACKEND.md). RFC-02: la clave nunca se muestra
// completa después de guardada, solo los últimos 4 caracteres.
const schema = z.object({
  label: z.string().min(3, "Mínimo 3 caracteres").max(60),
  apiKey: z.string().min(10, "La API key parece incompleta"),
  apiSecret: z.string().min(10, "El API secret parece incompleto"),
  isTestnet: z.boolean().default(false),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type WizardStep = "checklist" | "form" | "success" | null;

export default function ExchangePage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>(null);
  const [result, setResult] = useState<ConnectExchangeAccountResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["exchange-accounts"],
    queryFn: fetchExchangeAccounts,
  });

  async function invalidateAfterSync() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["exchange-accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["positions"] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["portfolio-allocation"] }),
    ]);
  }

  const connectMutation = useMutation({
    mutationFn: connectExchangeAccount,
    onSuccess: async (res) => {
      setResult(res);
      setStep("success");
      setSubmitError(null);
      await invalidateAfterSync();
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : "No se pudo conectar la cuenta.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncExchangeAccount,
    onSuccess: invalidateAfterSync,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectExchangeAccount,
    onSuccess: invalidateAfterSync,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { isTestnet: false },
  });

  function openWizard() {
    setSubmitError(null);
    setResult(null);
    reset();
    setStep("checklist");
  }

  function closeWizard() {
    setStep(null);
  }

  function onSubmit(values: FormOutput) {
    setSubmitError(null);
    connectMutation.mutate(values);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Cuenta de exchange</h1>

      <Card title="Cuentas conectadas">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Cargando…</p>
        ) : !accounts || accounts.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Todavía no conectaste ninguna cuenta de exchange.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {accounts.map((acc) => (
              <li key={acc.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{acc.label}</p>
                  <p className="text-sm text-text-secondary">
                    {acc.exchange} · {maskApiKey(acc.apiKeyLast4)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <SyncBadge status={acc.status} />
                    {acc.lastSyncedAt ? (
                      <p className="text-xs text-text-secondary">
                        Última sync: {new Date(acc.lastSyncedAt).toLocaleString("es-EC")}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => syncMutation.mutate(acc.id)}
                    disabled={syncMutation.isPending}
                    className="rounded-md border border-border-hairline px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Sincronizar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `¿Desconectar "${acc.label}"? Se borran sus posiciones sincronizadas (tus operaciones manuales no se tocan).`,
                        )
                      ) {
                        disconnectMutation.mutate(acc.id);
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                    className="rounded-md border border-border-hairline px-2 py-1 text-xs text-status-critical disabled:opacity-50"
                  >
                    Desconectar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {step === null ? (
        <button
          type="button"
          onClick={openWizard}
          className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Conectar cuenta de Binance
        </button>
      ) : null}

      {step === "checklist" ? (
        <Card title="Antes de conectar — paso 1 de 3">
          <div className="flex flex-col gap-3 text-sm text-text-secondary">
            <p>
              VAL-SISTEM solo necesita <strong>leer</strong> tu cuenta: balances e
              historial. Nunca hace falta darle permiso de trading ni de retiros.
            </p>
            <ol className="flex flex-col gap-2">
              <li>1. En Binance, andá a API Management y creá una API key nueva.</li>
              <li>
                2. Activá únicamente <strong>Enable Reading</strong>. Dejá apagado
                &quot;Enable Spot &amp; Margin Trading&quot; y &quot;Enable
                Withdrawals&quot;.
              </li>
              <li>3. Copiá la API key y el Secret Key (Binance solo los muestra una vez).</li>
            </ol>
            <p>
              Tus credenciales se guardan cifradas en el servidor y nunca vuelven a
              tu navegador después de guardadas.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
            >
              Entendido, continuar
            </button>
            <button
              type="button"
              onClick={closeWizard}
              className="rounded-md border border-border-hairline px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </Card>
      ) : null}

      {step === "form" ? (
        <Card title="Conectar cuenta de Binance — paso 2 de 3">
          <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Nombre de la cuenta
              <input
                {...register("label")}
                placeholder="Binance principal"
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.label ? (
                <span className="text-xs text-status-critical">{errors.label.message}</span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              API key
              <input
                type="password"
                autoComplete="off"
                {...register("apiKey")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.apiKey ? (
                <span className="text-xs text-status-critical">{errors.apiKey.message}</span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              API secret
              <input
                type="password"
                autoComplete="off"
                {...register("apiSecret")}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
              {errors.apiSecret ? (
                <span className="text-xs text-status-critical">{errors.apiSecret.message}</span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isTestnet")} />
              Es una cuenta de Binance Testnet (sin dinero real)
            </label>

            {submitError ? <p className="text-sm text-status-critical">{submitError}</p> : null}

            <div className="mt-1 flex gap-2">
              <button
                type="submit"
                disabled={connectMutation.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {connectMutation.isPending ? "Validando con Binance…" : "Conectar"}
              </button>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="rounded-md border border-border-hairline px-3 py-1.5 text-sm"
              >
                Atrás
              </button>
            </div>
          </form>
        </Card>
      ) : null}

      {step === "success" && result ? (
        <Card title="Cuenta conectada — paso 3 de 3">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-status-good">
              &quot;{result.label}&quot; se conectó y sincronizó correctamente.
            </p>
            <p className="text-text-secondary">{result.syncMessage}</p>
            {result.warning ? (
              <p className="rounded-md border border-status-warning bg-background p-3 text-status-warning">
                {result.warning}
              </p>
            ) : null}
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={closeWizard}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                Listo
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
