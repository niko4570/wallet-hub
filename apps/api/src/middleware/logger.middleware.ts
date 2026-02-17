import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    // Log request start
    console.log(`[${new Date().toISOString()}] [REQUEST] ${method} ${originalUrl} from ${ip}`);
    console.log(`[${new Date().toISOString()}] [HEADERS] User-Agent: ${headers['user-agent']}`);

    // Capture response details when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode, statusMessage } = res;
      console.log(`[${new Date().toISOString()}] [RESPONSE] ${method} ${originalUrl} ${statusCode} ${statusMessage} - ${duration}ms`);
    });

    next();
  }
}
