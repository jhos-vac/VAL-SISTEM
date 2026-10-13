import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SettingsService } from './settings.service';
import { AccountClosureService } from './account-closure.service';
import { UserPrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UserPrismaModule],
  controllers: [UsersController],
  providers: [UsersService, SettingsService, AccountClosureService],
  exports: [AccountClosureService],
})
export class UsersModule {}
