import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { UsersService } from './users.service';
import { SettingsService } from './settings.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {}

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/settings')
  getMySettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getSettings(user.id);
  }

  @Patch('me/settings')
  updateMySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user.id, dto);
  }

  // No es información personal (catálogo de referencia), pero se deja
  // detrás de sesión igual que el resto de /users por simplicidad — no
  // hay ninguna pantalla pública que la necesite todavía.
  @Get('settings/catalogs')
  getSettingsCatalogs() {
    return this.settingsService.getCatalogs();
  }
}
