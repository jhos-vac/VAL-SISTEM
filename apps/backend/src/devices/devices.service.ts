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
    const existing = await this.prisma.device.findFirst({
      where: { userId, pushToken: dto.pushToken },
    });

    const device = existing
      ? await this.prisma.device.update({
          where: { id: existing.id },
          data: {
            deviceName: dto.deviceName,
            platform: dto.platform,
            os: dto.os,
            appVersion: dto.appVersion,
            lastSeenAt: new Date(),
          },
        })
      : await this.prisma.device.create({
          data: {
            userId,
            deviceName: dto.deviceName,
            platform: dto.platform,
            os: dto.os,
            appVersion: dto.appVersion,
            pushToken: dto.pushToken,
          },
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
