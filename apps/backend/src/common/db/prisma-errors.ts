// Violación de un índice único (Prisma P2002). Se reconoce por código y no
// con instanceof para no depender de qué cliente generado (hay uno por
// base) lanzó el error.
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
