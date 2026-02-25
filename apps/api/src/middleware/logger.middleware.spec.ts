import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  it('logs request and response and calls next', () => {
    const middleware = new LoggerMiddleware();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (message?: any) => {
      logs.push(String(message));
    };

    const req: any = {
      method: 'GET',
      originalUrl: '/test',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };

    let finishHandler: (() => void) | undefined;
    const res: any = {
      statusCode: 200,
      statusMessage: 'OK',
      on: (event: string, handler: () => void) => {
        if (event === 'finish') {
          finishHandler = handler;
        }
      },
    };

    const next = jest.fn();
    middleware.use(req, res, next);
    finishHandler?.();

    expect(next).toHaveBeenCalled();
    expect(logs.some((line) => line.includes('[REQUEST]'))).toBe(true);
    expect(logs.some((line) => line.includes('[RESPONSE]'))).toBe(true);

    console.log = originalLog;
  });
});
