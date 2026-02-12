import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class SessionSecurityGuard implements CanActivate {
  private static readonly rateLimits = new Map<string, RateLimitEntry>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.enforceApiKey(request);
    this.enforceBodySize(request);
    this.enforceRateLimit(request);
    return true;
  }

  private enforceApiKey(request: Request): void {
    const expectedKey = (process.env.SESSION_API_KEY ?? '').trim();
    if (!expectedKey) {
      return;
    }

    const headerKey = this.extractApiKey(request);
    if (!headerKey || headerKey !== expectedKey) {
      throw new UnauthorizedException('Invalid API key.');
    }
  }

  private extractApiKey(request: Request): string | undefined {
    const headerValue = request.headers['x-api-key'];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim();
  }

  private enforceBodySize(request: Request): void {
    const maxBytes = Number(process.env.SESSION_MAX_BODY_BYTES ?? 65536);
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
      return;
    }

    const contentLength = request.headers['content-length'];
    if (typeof contentLength === 'string') {
      const parsed = Number(contentLength);
      if (Number.isFinite(parsed) && parsed > maxBytes) {
        throw new BadRequestException('Request body too large.');
      }
    }

    if (request.body && Object.keys(request.body).length > 0) {
      const bodySize = Buffer.byteLength(JSON.stringify(request.body));
      if (bodySize > maxBytes) {
        throw new BadRequestException('Request body too large.');
      }
    }
  }

  private enforceRateLimit(request: Request): void {
    const maxRequests = Number(process.env.SESSION_RATE_LIMIT_MAX ?? 60);
    const windowMs = Number(process.env.SESSION_RATE_LIMIT_WINDOW_MS ?? 60000);
    if (!Number.isFinite(maxRequests) || !Number.isFinite(windowMs)) {
      return;
    }

    const key = `${this.getClientId(request)}:${request.method}`;
    const now = Date.now();
    const entry = SessionSecurityGuard.rateLimits.get(key);

    if (!entry || entry.resetAt <= now) {
      SessionSecurityGuard.rateLimits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      throw new BadRequestException('Rate limit exceeded.');
    }
  }

  private getClientId(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }

    return request.ip ?? 'unknown';
  }
}
