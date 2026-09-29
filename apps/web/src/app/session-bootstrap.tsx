"use client";

import { useEffect } from "react";
import { refreshSession } from "@/lib/auth-client";

// Flag a nivel de módulo (no de instancia): en dev, React StrictMode monta
// este componente dos veces seguidas, y como el refresh token ROTA en
// cada uso, una segunda llamada casi simultánea revocaría el token que la
// primera acaba de emitir y tumbaría la sesión recién creada. Un ref por
// instancia no alcanza a prevenir eso (se resetea en el remount); este
// flag sí, porque vive en el módulo.
let bootstrapped = false;

// Al montar la app, intenta recuperar la sesión con el refresh token de
// la cookie httpOnly (el access token solo vive en memoria y se pierde en
// cada recarga — RNFC-01). No renderiza nada; solo deja el auth-store en
// "authenticated" o "unauthenticated" para que RequireAuth decida.
export function SessionBootstrap() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void refreshSession();
  }, []);

  return null;
}
