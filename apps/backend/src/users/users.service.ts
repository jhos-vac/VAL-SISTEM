import { ConflictException, Injectable } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import { toPublicUser, type PublicUser } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: UserPrismaService) {}

  // PATCH /users/me básico: firstName/lastName/username. El sub-recurso
  // de settings (idioma/moneda/tema/zona horaria) queda deliberadamente
  // afuera todavía — ver Estado_Backend_VAL-BACKEND.md.
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    if (dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Ese nombre de usuario ya está en uso');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.username !== undefined ? { username: dto.username } : {}),
        updatedAt: new Date(),
      },
    });

    return toPublicUser(user);
  }
}
