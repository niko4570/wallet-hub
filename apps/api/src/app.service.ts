import { Injectable } from '@nestjs/common';
import { InfrastructureConfigService } from './config/infrastructure-config.service';

@Injectable()
export class AppService {
  constructor(
    private readonly infrastructureConfig: InfrastructureConfigService,
  ) {}

  getHealth() {
    return {
      status: 'ok',
      message: 'WalletHub Core API ready',
      timestamp: new Date().toISOString(),
      infrastructure: this.infrastructureConfig.describe(),
    };
  }
}
