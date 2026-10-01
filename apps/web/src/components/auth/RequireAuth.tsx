"use client";

import { useEffect, useState } from "react";
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
  const [slow, setSlow] = useState(false);

  // El backend gratuito se duerme tras 15 min sin uso y tarda hasta ~1 min
  // en despertar: se avisa para que no parezca que la página se colgó.
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "idle" || status === "unauthenticated") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-background px-6 text-center text-sm text-text-muted">
        <span>Cargando sesión…</span>
        {slow ? (
          <span className="text-xs">
            El servidor estaba dormido y está despertando; puede tardar hasta 1 minuto.
          </span>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
