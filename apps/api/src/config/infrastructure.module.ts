import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfrastructureConfigService } from './infrastructure-config.service';
import appConfig from './app.config';
import { validationSchema, validationOptions } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema,
      validationOptions,
      envFilePath: '../../.env',
    }),
  ],
  providers: [InfrastructureConfigService],
  exports: [InfrastructureConfigService],
})
export class InfrastructureModule {}
