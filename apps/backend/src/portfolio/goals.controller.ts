import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalDto } from './dto/goal.dto';

@Controller()
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  // Acepta 'all' (vista General): metas de todos los portafolios.
  @Get('portfolios/:id/goals')
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.goals.list(user.id, id);
  }

  @Post('portfolios/:id/goals')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateGoalDto,
  ) {
    return this.goals.create(user.id, id, dto);
  }

  @Patch('goals/:goalId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goals.update(user.id, goalId, dto);
  }

  @Delete('goals/:goalId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('goalId') goalId: string,
  ) {
    await this.goals.remove(user.id, goalId);
    return { success: true };
  }
}
