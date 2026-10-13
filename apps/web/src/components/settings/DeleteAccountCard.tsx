"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { deleteAccount } from "@/lib/users-client";
import { logout } from "@/lib/auth-client";

// Borrado de cuenta: confirma con la contraseña y avisa que es irreversible.
export function DeleteAccountCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: async () => {
      queryClient.clear();
      // Limpia la sesión local y la cookie del refresh (ya revocado).
      await logout();
      router.replace("/login");
    },
  });

  return (
    <Card title="Eliminar cuenta">
      <div className="flex max-w-md flex-col gap-3 text-sm">
        <p className="text-text-secondary">
          Se borran tu cuenta, tus portafolios, posiciones, transacciones y las cuentas de
          Binance conectadas. No se puede deshacer.
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start rounded-md border border-status-critical px-3 py-1.5 font-medium text-status-critical"
          >
            Eliminar mi cuenta
          </button>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (password) mutation.mutate();
            }}
          >
            <label className="flex flex-col gap-1">
              Confirmá con tu contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-border-hairline bg-background px-3 py-2"
              />
            </label>
            {mutation.isError ? (
              <p className="text-status-critical">{mutation.error.message}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!password || mutation.isPending}
                className="rounded-md bg-status-critical px-3 py-1.5 font-medium text-white disabled:opacity-50"
              >
                {mutation.isPending ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setPassword("");
                  mutation.reset();
                }}
                className="rounded-md border border-border-hairline px-3 py-1.5"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
