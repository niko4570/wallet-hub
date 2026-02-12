import { Module } from '@nestjs/common';
import { InfrastructureConfigService } from './infrastructure-config.service';

@Module({
  providers: [InfrastructureConfigService],
  exports: [InfrastructureConfigService],
})
export class InfrastructureModule {}
