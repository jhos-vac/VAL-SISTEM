import type { NextConfig } from "next";

// URL real del backend (Render en producción, localhost en desarrollo).
// Solo la usa el servidor de Next para reenviar las peticiones: el navegador
// nunca habla directo con ella.
const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // El navegador llama a /backend-api/* en el MISMO dominio de la web y
  // Next lo reenvía al backend. Así la cookie de sesión (refresh token) es
  // de primera parte: con web y backend en dominios distintos
  // (vercel.app vs onrender.com) el navegador no la enviaba y cada recarga
  // de la página mandaba al login.
  async rewrites() {
    return [
      {
        source: "/backend-api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },

  // packages/shared no tiene paso de build propio (su "main" apunta a
  // src/index.ts en TypeScript crudo) — sin esto, `next build` no
  // transpila ese paquete al vivir en node_modules vía workspace symlink
  // y el build de producción (en Vercel) rompe aunque `next dev` no se
  // haya quejado.
  transpilePackages: ["@val-sistem/shared"],
};

export default nextConfig;
