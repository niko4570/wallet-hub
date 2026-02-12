import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './config/infrastructure.module';
import { SessionModule } from './session/session.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [InfrastructureModule, WalletsModule, SessionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
