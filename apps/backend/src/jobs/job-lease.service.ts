import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { PortfolioPrismaService } from '../prisma/portfolio-prisma.service';

// Lease en base para los jobs periódicos: con varias instancias del backend,
// solo una corre cada job a la vez. Si la instancia que lo tiene se cae, el
// lease vence solo (ttl) y otra lo puede tomar.
@Injectable()
export class JobLeaseService {
  // Identifica a esta instancia como dueña del lease.
  private readonly owner = `${hostname()}:${process.pid}:${randomUUID()}`;

  constructor(private readonly prisma: PortfolioPrismaService) {}

  // Toma el lease si está libre o vencido. Atómico: el INSERT … ON CONFLICT
  // solo actualiza (y devuelve fila) si el lease actual ya venció.
  async tryAcquire(name: string, ttlMs: number): Promise<boolean> {
    const until = new Date(Date.now() + ttlMs);
    const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
      INSERT INTO "job_leases" ("name", "locked_until", "locked_by")
      VALUES (${name}, ${until}, ${this.owner})
      ON CONFLICT ("name") DO UPDATE
        SET "locked_until" = EXCLUDED."locked_until",
            "locked_by" = EXCLUDED."locked_by"
        WHERE "job_leases"."locked_until" < now()
      RETURNING "name"`;
    return rows.length === 1;
  }

  async release(name: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "job_leases" SET "locked_until" = now()
      WHERE "name" = ${name} AND "locked_by" = ${this.owner}`;
  }
}
