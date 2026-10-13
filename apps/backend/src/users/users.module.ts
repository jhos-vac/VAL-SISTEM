import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SettingsService } from './settings.service';
import { UserPrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UserPrismaModule],
  controllers: [UsersController],
  providers: [UsersService, SettingsService],
})
export class UsersModule {}
