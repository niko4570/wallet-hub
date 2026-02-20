import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();

    console.log(
      `[${new Date().toISOString()}] Request: ${request.method} ${request.url}`,
    );

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - now;
        console.log(
          `[${new Date().toISOString()}] Response: ${request.method} ${request.url} ${response.statusCode} - ${duration}ms`,
        );
      }),
    );
  }
}
