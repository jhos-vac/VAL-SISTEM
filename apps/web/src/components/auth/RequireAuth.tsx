"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

// Protege las rutas del dashboard: mientras SessionBootstrap todavía está
// resolviendo el refresh inicial (status "idle") no se sabe si hay sesión
// o no, así que se muestra un estado neutro en vez de parpadear el
// contenido o mandar a /login de más. Si termina en "unauthenticated",
// redirige. Nunca bloquea el render del layout ya autenticado.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "idle" || status === "unauthenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-text-muted">
        Cargando sesión…
      </div>
    );
  }

  return <>{children}</>;
}
