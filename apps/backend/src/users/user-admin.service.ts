import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';

const DAY_MS = 86_400_000;

export type AdminUserStatus = 'Active' | 'Suspended';

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  status: string;
  emailVerified: boolean;
  roles: string[];
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface UserMetrics {
  total: number;
  suspended: number;
  admins: number;
  newLast7Days: number;
  newLast30Days: number;
  activeLast7Days: number;
  activeLast30Days: number;
  signupsByDay: { date: string; count: number }[];
}

export interface RecentFailure {
  method: string;
  path: string;
  message: string | null;
  userId: string | null;
  createdAt: Date;
}

// Operaciones de administración sobre la base Identity. Solo las expone el
// módulo Admin (detrás de @Roles('admin')).
@Injectable()
export class UserAdminService {
  constructor(private readonly prisma: UserPrismaService) {}

  async listUsers(filters: {
    search?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: AdminUserRow[]; total: number }> {
    const search = filters.search?.trim();
    const where = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { username: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);
    return {
      total,
      items: users.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        email: u.email,
        status: u.status,
        emailVerified: u.emailVerified,
        roles: u.roles.map((r) => r.role.name),
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
    };
  }

  async emailsByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.email]));
  }

  // Suspender cierra todas las sesiones: el refresh deja de servir y el
  // access token vigente vence solo en pocos minutos.
  async setStatus(
    actorId: string,
    userId: string,
    status: AdminUserStatus,
  ): Promise<AdminUserRow> {
    if (actorId === userId) {
      throw new BadRequestException(
        'No podés cambiar el estado de tu propia cuenta',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status, updatedAt: new Date() },
      });
      if (status === 'Suspended') {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });
    const { items } = await this.listUsers({
      search: user.email,
      page: 1,
      pageSize: 1,
    });
    return items[0];
  }

  async metrics(now = new Date()): Promise<UserMetrics> {
    const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const alive = { deletedAt: null };
    const [total, suspended, admins, new7, new30, active7, active30, recent] =
      await Promise.all([
        this.prisma.user.count({ where: alive }),
        this.prisma.user.count({ where: { ...alive, status: 'Suspended' } }),
        this.prisma.user.count({
          where: { ...alive, roles: { some: { role: { name: 'admin' } } } },
        }),
        this.prisma.user.count({
          where: { ...alive, createdAt: { gte: ago(7) } },
        }),
        this.prisma.user.count({
          where: { ...alive, createdAt: { gte: ago(30) } },
        }),
        this.prisma.user.count({
          where: { ...alive, lastLoginAt: { gte: ago(7) } },
        }),
        this.prisma.user.count({
          where: { ...alive, lastLoginAt: { gte: ago(30) } },
        }),
        this.prisma.user.findMany({
          where: { createdAt: { gte: ago(30) } },
          select: { createdAt: true },
        }),
      ]);
    return {
      total,
      suspended,
      admins,
      newLast7Days: new7,
      newLast30Days: new30,
      activeLast7Days: active7,
      activeLast30Days: active30,
      signupsByDay: signupsByDay(
        recent.map((r) => r.createdAt),
        now,
      ),
    };
  }

  // Mutaciones que fallaron (audit_logs) en las últimas 24 h.
  async recentFailures(
    limit = 20,
    now = new Date(),
  ): Promise<{ failed24h: number; total24h: number; items: RecentFailure[] }> {
    const since = new Date(now.getTime() - DAY_MS);
    const [failed24h, total24h, items] = await Promise.all([
      this.prisma.auditLog.count({
        where: { createdAt: { gte: since }, statusOk: false },
      }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: since }, statusOk: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          method: true,
          path: true,
          message: true,
          userId: true,
          createdAt: true,
        },
      }),
    ]);
    return { failed24h, total24h, items };
  }
}

// Altas por día (UTC) de los últimos 30 días, incluidos los días en cero.
export function signupsByDay(
  dates: Date[],
  now: Date,
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return days;
}
