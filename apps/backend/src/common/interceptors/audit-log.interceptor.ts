import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs';
import { UserPrismaService } from '../../prisma/user-prisma.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

// Auditoría de acciones críticas (mutaciones: POST/PUT/PATCH/DELETE).
// Además del log por consola (Nest Logger), escribe cada mutación en la
// tabla audit_logs (dominio Identity) — antes esto era solo un TODO, ver
// Estado_Backend_VAL-BACKEND.md.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: UserPrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    if (!MUTATING_METHODS.has(req.method)) return next.handle();

    const userId = req.user?.id ?? null;
    const start = Date.now();

    // La escritura a la base es "fire and forget" (no se espera ni
    // bloquea la respuesta al cliente): un fallo acá nunca debe romper
    // el request que se está auditando, solo queda logueado aparte.
    const writeAuditLog = (statusOk: boolean, message?: string) => {
      this.prisma.auditLog
        .create({
          data: {
            userId,
            method: req.method,
            path: req.originalUrl,
            statusOk,
            ipAddress: req.ip ?? 'unknown',
            userAgent: req.headers['user-agent'] ?? 'unknown',
            message,
            durationMs: Date.now() - start,
          },
        })
        .catch((err: unknown) => {
          this.logger.error('No se pudo escribir el audit log en la base', err);
        });
    };

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${req.method} ${req.originalUrl} user=${userId ?? 'anonymous'} ip=${req.ip} ok (${Date.now() - start}ms)`,
          );
          writeAuditLog(true);
        },
        error: (err: Error) => {
          this.logger.warn(
            `${req.method} ${req.originalUrl} user=${userId ?? 'anonymous'} ip=${req.ip} FAILED: ${err.message}`,
          );
          writeAuditLog(false, err.message);
        },
      }),
    );
  }
}
