"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { register as registerUser } from "@/lib/auth-client";
import { ApiError } from "@/lib/api-client";

// Límites espejo de RegisterDto en VAL-BACKEND (src/auth/dto/register.dto.ts)
// — validar acá evita un viaje redondo solo para enterarse de un límite.
const schema = z
  .object({
    firstName: z.string().min(2, "Mínimo 2 caracteres").max(80),
    lastName: z.string().min(2, "Mínimo 2 caracteres").max(80),
    username: z.string().min(3, "Mínimo 3 caracteres").max(30),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
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
      await registerUser({
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.username,
        email: values.email,
        password: values.password,
      });
      router.push("/login");
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
      <h1 className="text-center text-base font-semibold">Crear cuenta</h1>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Nombre
          <input
            type="text"
            {...register("firstName")}
            className="rounded-md border border-border-hairline bg-background px-3 py-2"
          />
          {errors.firstName ? (
            <span className="text-xs text-status-critical">{errors.firstName.message}</span>
          ) : null}
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm">
          Apellido
          <input
            type="text"
            {...register("lastName")}
            className="rounded-md border border-border-hairline bg-background px-3 py-2"
          />
          {errors.lastName ? (
            <span className="text-xs text-status-critical">{errors.lastName.message}</span>
          ) : null}
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Usuario
        <input
          type="text"
          {...register("username")}
          className="rounded-md border border-border-hairline bg-background px-3 py-2"
        />
        {errors.username ? (
          <span className="text-xs text-status-critical">{errors.username.message}</span>
        ) : null}
      </label>

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
        Crear cuenta
      </button>

      <p className="mt-2 text-center text-sm text-text-secondary">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
