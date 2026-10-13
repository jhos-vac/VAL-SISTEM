import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { UserPrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [UserPrismaModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
