import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

// Registro de dispositivo (push token) — RNF de Identity pendiente en la
// Bitácora. Requiere sesión: un dispositivo siempre pertenece a un
// usuario logueado (se llama justo después de login, ver
// Especificacion_Web_Movil_MVP.md).
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devicesService.register(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.list(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.devicesService.remove(user.id, id);
    return { success: true };
  }
}
