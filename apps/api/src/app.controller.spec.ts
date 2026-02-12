import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureConfigService } from './config/infrastructure-config.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, InfrastructureConfigService],
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
