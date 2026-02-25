import { CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  it('logs request and response', async () => {
    const interceptor = new LoggingInterceptor();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: any) => {
      logs.push(String(message));
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/test' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    };

    const next: CallHandler = {
      handle: () => of('ok'),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(logs.some((line) => line.includes('Request: GET /test'))).toBe(true);
    expect(logs.some((line) => line.includes('Response: GET /test'))).toBe(true);

    console.log = originalLog;
  });
});
