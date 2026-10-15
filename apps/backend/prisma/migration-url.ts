// URL que usa la CLI de Prisma (migrate deploy/status/diff) para cada base.
//
// Las migraciones van por la conexión DIRECTA de Neon, no por el pooler
// (host con "-pooler"): `prisma migrate` toma un advisory lock de sesión y,
// a través del pooler (PgBouncer en modo transacción), el desbloqueo puede
// ir a otra conexión y el lock queda retenido en una conexión del pool, que
// después la app reutiliza. El siguiente deploy espera ese lock y falla con
// P1002. La app en runtime sigue usando el pooler (ver *-prisma.service.ts).
//
// Prioridad: <NOMBRE>_DIRECT si está definida; si no, la URL normal sin
// "-pooler". También se recortan espacios sobrantes (un espacio al final de
// la URL en el .env rompía la conexión).
export function migrationUrl(envName: string): string | undefined {
  const direct = process.env[`${envName}_DIRECT`]?.trim();
  if (direct) return direct;
  return process.env[envName]?.trim().replace("-pooler.", ".");
}
