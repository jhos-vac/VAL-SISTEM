// Pantalla de auth "premium": fondo casi negro con una grilla sutil y un
// resplandor azul radial detrás de la tarjeta — el mismo lenguaje visual
// que el resto de la app, aplicado al login/registro/recuperación.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border-hairline bg-surface/90 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            V
          </span>
          <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold tracking-tight">
            VAL-SISTEM
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
