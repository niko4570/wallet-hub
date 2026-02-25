import { AppService } from './app.service';

describe('AppService', () => {
  it('returns health payload with infrastructure', () => {
    const infra = { describe: jest.fn().mockReturnValue({ database: {} }) };
    const service = new AppService(infra as any);
    const result = service.getHealth();
    expect(result.status).toBe('ok');
    expect(result.infrastructure).toEqual({ database: {} });
  });
});
