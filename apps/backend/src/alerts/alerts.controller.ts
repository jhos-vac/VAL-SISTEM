import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AlertsService } from './alerts.service';
import {
  CreateAlertRuleDto,
  ListNotificationsQueryDto,
  MarkReadDto,
  SetAutoAlertDto,
  UpdateAlertRuleDto,
} from './dto/alerts.dto';

@Controller()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.alerts.overview(user.id);
  }

  @Post('alerts/rules')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.alerts.create(user.id, dto);
  }

  @Patch('alerts/rules/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alerts.update(user.id, id, dto);
  }

  @Delete('alerts/rules/:id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.alerts.remove(user.id, id);
  }

  @Put('alerts/auto')
  setAuto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetAutoAlertDto,
  ) {
    return this.alerts.setAuto(user.id, dto);
  }

  @Get('notifications')
  notifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.alerts.listNotifications(user.id, query.limit);
  }

  @Post('notifications/read')
  @HttpCode(HttpStatus.OK)
  markRead(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkReadDto) {
    return this.alerts.markRead(user.id, dto.ids);
  }
}
