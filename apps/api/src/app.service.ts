import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      message: 'WalletHub Core API ready',
      timestamp: new Date().toISOString(),
    };
  }
}
