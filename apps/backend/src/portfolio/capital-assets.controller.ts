import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CapitalAssetService } from './capital-asset.service';
import { UpdateCapitalAssetsDto } from './dto/update-capital-assets.dto';

@Controller('capital-assets')
export class CapitalAssetsController {
  constructor(private readonly capitalAssetService: CapitalAssetService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.capitalAssetService.list(user.id);
  }

  @Put()
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCapitalAssetsDto,
  ) {
    return this.capitalAssetService.replace(user.id, dto.symbols);
  }
}
