import { Injectable, NotFoundException } from '@nestjs/common';
import { UserPrismaService } from '../prisma/user-prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

export interface DeviceDto {
  id: string;
  deviceName: string;
  platform: string;
  os: string;
  appVersion: string;
  lastSeenAt: string;
}

function toDto(d: {
  id: string;
  deviceName: string;
  platform: string;
  os: string;
  appVersion: string;
  lastSeenAt: Date;
}): DeviceDto {
  return {
    id: d.id,
    deviceName: d.deviceName,
    platform: d.platform,
    os: d.os,
    appVersion: d.appVersion,
    lastSeenAt: d.lastSeenAt.toISOString(),
  };
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: UserPrismaService) {}

  // "Registrar" un dispositivo es en la práctica un upsert por
  // (userId, pushToken) hecho a mano (el schema no tiene ese @unique
  // compuesto): mismo dispositivo relogueándose actualiza
  // lastSeenAt/appVersion en vez de crear una fila nueva cada vez que
  // abre la app.
  async register(userId: string, dto: RegisterDeviceDto): Promise<DeviceDto> {
    // Un dispositivo por (usuario, push token): volver a registrarlo
    // actualiza sus datos en vez de duplicarlo.
    const details = {
      deviceName: dto.deviceName,
      platform: dto.platform,
      os: dto.os,
      appVersion: dto.appVersion,
    };
    const device = await this.prisma.device.upsert({
      where: { userId_pushToken: { userId, pushToken: dto.pushToken } },
      update: { ...details, lastSeenAt: new Date() },
      create: { userId, pushToken: dto.pushToken, ...details },
    });

    return toDto(device);
  }

  async list(userId: string): Promise<DeviceDto[]> {
    const devices = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map(toDto);
  }

  async remove(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) {
      throw new NotFoundException('Dispositivo no encontrado');
    }
    await this.prisma.device.delete({ where: { id: device.id } });
  }
}
