// Lock de Postgres atado a la transacción (pg_advisory_xact_lock): se
// libera solo al commit o rollback. Sirve para serializar operaciones de
// una misma entidad lógica (p.ej. "los portafolios de este usuario") sin
// bloquear tablas enteras y aunque la fila todavía no exista. Funciona con
// el pooler de Neon porque vive dentro de la transacción, no de la sesión.
interface RawQueryClient {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): PromiseLike<T>;
}

// Espera a que se libere si otro lo tiene.
export async function lockForTransaction(
  tx: RawQueryClient,
  key: string,
): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
}

// No espera: devuelve false si otro ya lo tiene.
export async function tryLockForTransaction(
  tx: RawQueryClient,
  key: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`;
  return rows[0]?.locked === true;
}
