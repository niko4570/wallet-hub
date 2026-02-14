import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../config/infrastructure.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HeliusController } from './helius.controller';
import { HeliusService } from './helius.service';

@Module({
  imports: [InfrastructureModule, NotificationsModule],
  controllers: [HeliusController],
  providers: [HeliusService],
  exports: [HeliusService],
})
export class HeliusModule {}
