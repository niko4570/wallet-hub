import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './config/infrastructure.module';
import { HeliusModule } from './helius/helius.module';
import { SessionModule } from './session/session.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    InfrastructureModule,
    ScheduleModule.forRoot(),
    HeliusModule,
    WalletsModule,
    SessionModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
