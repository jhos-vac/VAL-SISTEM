import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SettingsService } from './settings.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SettingsService],
})
export class UsersModule {}
