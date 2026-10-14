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
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { StrategyService } from './strategy.service';
import {
  CreateDcaPlanDto,
  SetTargetAllocationDto,
  UpdateDcaPlanDto,
} from './dto/strategy.dto';

@Controller()
export class StrategyController {
  constructor(private readonly strategy: StrategyService) {}

  @Get('portfolios/:id/target-allocation')
  getTargetAllocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.strategy.getTargetAllocation(user.id, id);
  }

  @Put('portfolios/:id/target-allocation')
  setTargetAllocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetTargetAllocationDto,
  ) {
    return this.strategy.setTargetAllocation(user.id, id, dto.items);
  }

  // Acepta 'all' (vista General).
  @Get('portfolios/:id/dca-plans')
  listDcaPlans(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.strategy.listDcaPlans(user.id, id);
  }

  @Post('portfolios/:id/dca-plans')
  createDcaPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDcaPlanDto,
  ) {
    return this.strategy.createDcaPlan(user.id, id, dto);
  }

  @Patch('dca-plans/:planId')
  updateDcaPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
    @Body() dto: UpdateDcaPlanDto,
  ) {
    return this.strategy.updateDcaPlan(user.id, planId, dto);
  }

  @Delete('dca-plans/:planId')
  @HttpCode(HttpStatus.OK)
  async deleteDcaPlan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId') planId: string,
  ) {
    await this.strategy.deleteDcaPlan(user.id, planId);
    return { success: true };
  }
}
