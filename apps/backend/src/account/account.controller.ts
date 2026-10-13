import { Body, Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AccountDeletionService } from './account-deletion.service';
import { CloseAccountDto } from './dto/close-account.dto';

@Controller('account')
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  // Borra la cuenta y todos sus datos. Irreversible.
  @Delete()
  @HttpCode(HttpStatus.OK)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloseAccountDto,
  ) {
    await this.deletion.deleteAccount(user.id, dto.password);
    return { success: true };
  }
}
