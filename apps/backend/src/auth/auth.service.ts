import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { UserPrismaService } from '../prisma/user-prisma.service';
import { EmailService } from '../common/email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_SALT_ROUNDS = 12;

// Vida corta a propósito (1 hora) — es un link mandado por email, no un
// token de sesión de larga duración.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// Rol asignado automáticamente a todo el que se registra desde
// POST /auth/register — el rol "admin" nunca se asigna solo, se otorga a
// mano (hoy vía npm run db:seed:user; más adelante desde un panel).
const DEFAULT_REGISTRATION_ROLE = 'user';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// Perfil público del usuario — nunca incluye passwordHash. El shape exacto
// que el cliente web/móvil va a consumir se termina de acordar cuando se
// conecte de verdad (ver Estado_Backend_VAL-BACKEND.md); esto es lo que
// hoy vive de verdad en el dominio Identity.
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
}

export function toPublicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
}): PublicUser {
  const {
    id,
    firstName,
    lastName,
    username,
    email,
    emailVerified,
    status,
    createdAt,
  } = user;
  return {
    id,
    firstName,
    lastName,
    username,
    email,
    emailVerified,
    status,
    createdAt,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: UserPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {
    const days = Number(this.config.get('JWT_REFRESH_EXPIRES_IN_DAYS') ?? 30);
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'username';
      throw new ConflictException(`Ya existe una cuenta con ese ${field}`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        email: dto.email,
        passwordHash,
      },
    });

    await this.assignDefaultRole(user.id);

    this.logger.log(`Nuevo usuario registrado: ${user.email}`);
    return toPublicUser(user);
  }

  // Le da el rol base a todo usuario nuevo. Si el catálogo de roles
  // todavía no se sembró (npm run db:seed:user), no rompe el registro —
  // el usuario queda sin rol hasta que se corra el seed y se le asigne a
  // mano, igual que pasaba antes de que esto existiera.
  private async assignDefaultRole(userId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { name: DEFAULT_REGISTRATION_ROLE },
    });
    if (!role) {
      this.logger.warn(
        `No existe el rol "${DEFAULT_REGISTRATION_ROLE}" todavía (corré npm run db:seed:user) — el usuario quedó sin rol asignado.`,
      );
      return;
    }
    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
  }

  private async getRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return userRoles.map((ur) => ur.role.name);
  }

  private async validateCredentials(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.status !== 'Active') {
      throw new ForbiddenException('Cuenta inactiva o suspendida');
    }
    return user;
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<{ user: PublicUser } & TokenPair> {
    const user = await this.validateCredentials(dto.email, dto.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokenPair(user.id, user.email, meta);
    return { user: toPublicUser(user), ...tokens };
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    meta: RequestMeta,
  ): Promise<TokenPair> {
    // Roles reales desde la base (antes esto era siempre `[]` — RolesGuard
    // nunca tenía nada contra qué validar). Se resuelven acá, no una vez
    // sola al loguear, para que un cambio de rol se refleje en el próximo
    // refresh sin esperar a que expire el access token viejo.
    const roles = await this.getRoleNames(userId);

    const accessToken = await this.jwt.signAsync({
      sub: userId,
      email,
      roles,
    });

    // Refresh token opaco (no JWT): se guarda hasheado en RefreshToken para
    // poder revocarlo/rotarlo — un JWT de refresh no se puede invalidar sin
    // una blocklist aparte, y el schema ya está pensado para esto
    // (tokenHash/expiresAt/revokedAt).
    const rawRefreshToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  async refresh(
    rawRefreshToken: string,
    meta: RequestMeta,
  ): Promise<{ user: PublicUser } & TokenPair> {
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.deletedAt
    ) {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    // Rotación: el refresh usado queda revocado y se emite uno nuevo. Si
    // alguien reutiliza un refresh ya rotado, esto lo bloquea.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(
      stored.user.id,
      stored.user.email,
      meta,
    );
    return { user: toPublicUser(stored.user), ...tokens };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Cambiar contraseña cierra sesión en todos los demás dispositivos.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Respuesta genérica siempre (no confirmar/negar si el email existe)
    // — por eso esto no tira si el usuario no existe, simplemente no
    // genera token ni manda nada.
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.emailService.sendPasswordResetEmail(user.email, resetLink);
    this.logger.log(
      `Token de recuperación de contraseña generado para ${email}`,
    );
  }

  // Consume el token generado por requestPasswordReset. Un token solo se
  // puede usar una vez (usedAt) y expira a la hora — igual que el
  // refresh token, se guarda hasheado (nunca en texto plano) para que
  // una fuga de la base no sea directamente utilizable.
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'El enlace de recuperación es inválido o expiró',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Igual que change-password: restablecer la contraseña cierra
      // todas las sesiones existentes.
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return toPublicUser(user);
  }
}
