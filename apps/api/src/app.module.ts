import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './config/infrastructure.module';
import { DatabaseModule } from './database/database.module';
import { HeliusModule } from './helius/helius.module';
import { SessionModule } from './session/session.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletsModule } from './wallets/wallets.module';
import { LoggerMiddleware } from './middleware/logger.middleware';

@Module({
  imports: [
    InfrastructureModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    HeliusModule,
    WalletsModule,
    SessionModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
