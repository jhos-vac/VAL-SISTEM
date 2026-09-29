"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "@/lib/auth-client";
import { ApiError } from "@/lib/api-client";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});
type FormValues = z.infer<typeof schema>;

// RFW-01: registro e inicio de sesión, recuperación de contraseña.
export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values);
      router.push("/dashboard");
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Intenta de nuevo."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <h1 className="text-center text-base font-semibold">Iniciar sesión</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          {...register("email")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.email ? <span className="text-xs text-status-critical">{errors.email.message}</span> : null}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          type="password"
          {...register("password")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.password ? (
          <span className="text-xs text-status-critical">{errors.password.message}</span>
        ) : null}
      </label>

      {formError ? <p className="text-sm text-status-critical">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Entrar
      </button>

      <div className="mt-2 flex justify-between text-sm text-text-secondary">
        <Link href="/forgot-password" className="text-primary">
          Olvidé mi contraseña
        </Link>
        <Link href="/register" className="text-primary">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
