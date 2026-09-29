"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/auth-client";
import { ApiError } from "@/lib/api-client";

const schema = z
  .object({
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

// Consume el link que manda el email de recuperación
// (POST /auth/forgot-password → EmailService → .../reset-password?token=...),
// ver Estado_Backend_VAL-BACKEND.md. useSearchParams() necesita un
// boundary de Suspense en Next 16 para no romper el build estático.
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!token) return;
    setFormError(null);
    try {
      await resetPassword({ token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Intenta de nuevo.",
      );
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-base font-semibold">Enlace inválido</h1>
        <p className="text-sm text-text-secondary">
          Este enlace no tiene un token de recuperación. Pedí uno nuevo desde{" "}
          <Link href="/forgot-password" className="text-primary">
            recuperar contraseña
          </Link>
          .
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-base font-semibold">Contraseña actualizada</h1>
        <p className="text-sm text-text-secondary">
          Ya podés iniciar sesión con tu nueva contraseña.
        </p>
        <Link
          href="/login"
          className="mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <h1 className="text-center text-base font-semibold">Elegir nueva contraseña</h1>

      <label className="flex flex-col gap-1 text-sm">
        Nueva contraseña
        <input
          type="password"
          {...register("newPassword")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.newPassword ? (
          <span className="text-xs text-status-critical">{errors.newPassword.message}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Confirmar contraseña
        <input
          type="password"
          {...register("confirmPassword")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.confirmPassword ? (
          <span className="text-xs text-status-critical">{errors.confirmPassword.message}</span>
        ) : null}
      </label>

      {formError ? <p className="text-sm text-status-critical">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Guardar contraseña
      </button>

      <p className="mt-2 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-text-secondary">Cargando…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
