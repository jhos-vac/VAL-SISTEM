"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { forgotPassword } from "@/lib/auth-client";
import { ApiError } from "@/lib/api-client";

const schema = z.object({ email: z.string().email("Email inválido") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Intenta de nuevo."
      );
    }
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-text-secondary">
        Si el email existe, enviamos instrucciones para recuperar tu contraseña.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <h1 className="text-center text-base font-semibold">Recuperar contraseña</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          {...register("email")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.email ? <span className="text-xs text-status-critical">{errors.email.message}</span> : null}
      </label>

      {formError ? <p className="text-sm text-status-critical">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Enviar instrucciones
      </button>

      <p className="mt-2 text-center text-sm text-text-secondary">
        <Link href="/login" className="text-primary">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
