import { ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { UserPrismaService } from '../prisma/user-prisma.service';

const DELETED_STATUS = 'Deleted';

// Baja de la cuenta en la base Identity. La fila del usuario se conserva
// (los registros de auditoría la referencian), pero sin datos personales:
// email, usuario y nombre se reemplazan, la contraseña queda inutilizable y
// se borran sesiones, dispositivos, ajustes y tokens de recuperación. El
// email queda libre para registrarse de nuevo.
@Injectable()
export class AccountClosureService {
  constructor(private readonly prisma: UserPrismaService) {}

  async close(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.deletedAt) return; // ya estaba dada de baja
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      // 403 y no 401: el cliente trata 401 como sesión vencida y renovaría
      // el token para reintentar, sin sentido acá.
      throw new ForbiddenException('La contraseña no es correcta');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          status: DELETED_STATUS,
          email: `deleted+${userId}@deleted.invalid`,
          username: `deleted_${userId}`,
          firstName: 'Cuenta',
          lastName: 'eliminada',
          // Hash de un valor aleatorio: ninguna contraseña coincide.
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
          updatedAt: now,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.device.deleteMany({ where: { userId } }),
      this.prisma.userSetting.deleteMany({ where: { userId } }),
      this.prisma.userRole.deleteMany({ where: { userId } }),
    ]);
  }

  // Cuentas dadas de baja en los últimos `days` días: el job de limpieza
  // vuelve a borrar sus datos de los otros dominios por si algo quedó (un
  // fallo a mitad de camino o una escritura con un access token todavía
  // vigente, que dura hasta 15 min).
  async listRecentlyClosed(days: number): Promise<string[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: { gte: since } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
