import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/shared no tiene paso de build propio (su "main" apunta a
  // src/index.ts en TypeScript crudo) — sin esto, `next build` no
  // transpila ese paquete al vivir en node_modules vía workspace symlink
  // y el build de producción (en Vercel) rompe aunque `next dev` no se
  // haya quejado.
  transpilePackages: ["@val-sistem/shared"],
};

export default nextConfig;
