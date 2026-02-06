import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SessionModule } from './session/session.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [WalletsModule, SessionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
