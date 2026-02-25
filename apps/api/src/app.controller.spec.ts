import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureConfigService } from './config/infrastructure-config.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        InfrastructureConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              switch (key) {
                case 'database.url':
                  return 'postgres://localhost:5432/test';
                case 'solana.rpcUrl':
                  return 'https://rpc.test';
                case 'solana.priorityRpcUrl':
                  return 'https://rpc.test';
                case 'helius.apiKey':
                  return 'test';
                case 'session.enabled':
                  return true;
                default:
                  return undefined;
              }
            },
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health payload', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.message).toBeDefined();
    });
  });
});
