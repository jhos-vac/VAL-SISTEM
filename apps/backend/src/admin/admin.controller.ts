import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AdminService } from './admin.service';
import { ListUsersQueryDto, SetUserStatusDto } from './dto/admin.dto';

// Todo el controlador exige el rol admin (RolesGuard global).
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query() query: ListUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id/status')
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.admin.setUserStatus(user.id, id, dto.status);
  }

  @Get('health')
  health() {
    return this.admin.health();
  }

  @Get('public-portfolios')
  publicPortfolios() {
    return this.admin.listPublicPortfolios();
  }

  @Post('public-portfolios/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  async unpublish(@Param('id', ParseUUIDPipe) id: string) {
    await this.admin.unpublish(id);
    return { success: true };
  }
}
