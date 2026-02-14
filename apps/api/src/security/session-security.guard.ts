import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Request } from 'express';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const SIGNATURE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_NONCE_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class SessionSecurityGuard implements CanActivate {
  private static readonly rateLimits = new Map<string, RateLimitEntry>();
  private static readonly nonceCache = new Map<string, number>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    this.enforceApiKey(request);
    this.enforceBodySize(request);
    this.enforceRateLimit(request);
    if (SIGNATURE_METHODS.has(request.method.toUpperCase())) {
      this.enforceWalletSignature(request);
    }
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

  private enforceWalletSignature(request: Request): void {
    if (request.method === 'OPTIONS') {
      return;
    }

    const walletAddress = this.getHeaderValue(request, 'x-wallet-address');
    const nonce = this.getHeaderValue(request, 'x-wallet-nonce');
    const signature = this.getHeaderValue(request, 'x-wallet-signature');
    const bodyHashHeader = this.getHeaderValue(request, 'x-wallet-body-hash');
    const signatureVersion = this.getHeaderValue(
      request,
      'x-wallet-signature-version',
    );

    if (!walletAddress || !nonce || !signature || !bodyHashHeader) {
      throw new UnauthorizedException('Wallet signature headers are required.');
    }

    if (signatureVersion && signatureVersion !== '1') {
      throw new UnauthorizedException('Unsupported wallet signature version.');
    }

    this.assertFreshNonce(walletAddress, nonce);

    const bodyString = this.getBodyAsString(request);
    const computedBodyHash = this.hashBody(bodyString);
    if (computedBodyHash !== bodyHashHeader) {
      throw new BadRequestException('Request body hash mismatch.');
    }

    const canonicalMessage = this.buildCanonicalMessage(
      request,
      nonce,
      bodyHashHeader,
    );

    if (!this.verifySignature(walletAddress, canonicalMessage, signature)) {
      throw new UnauthorizedException('Invalid wallet signature.');
    }

    this.assertBodyWalletMatch(request, walletAddress);
  }

  private getHeaderValue(request: Request, header: string): string | undefined {
    const value = request.headers[header];
    if (typeof value === 'string') {
      return value.trim();
    }
    if (Array.isArray(value) && value.length > 0) {
      return value[0]?.trim();
    }
    return undefined;
  }

  private getBodyAsString(request: Request): string {
    if (!request.body || Object.keys(request.body).length === 0) {
      return '';
    }

    if (typeof request.body === 'string') {
      return request.body;
    }

    return JSON.stringify(request.body);
  }

  private hashBody(body: string): string {
    if (!body) {
      return createHash('sha256').update('').digest('hex');
    }
    return createHash('sha256').update(body, 'utf8').digest('hex');
  }

  private buildCanonicalMessage(
    request: Request,
    nonce: string,
    bodyHash: string,
  ): string {
    const basePath = `${request.baseUrl ?? ''}${request.path ?? ''}` || '/';
    return `WalletHub|${request.method.toUpperCase()}|${basePath}|${nonce}|${bodyHash}`;
  }

  private verifySignature(
    walletAddress: string,
    message: string,
    signatureBase64: string,
  ): boolean {
    try {
      const publicKey = bs58.decode(walletAddress);
      if (publicKey.length !== nacl.sign.publicKeyLength) {
        throw new UnauthorizedException('Invalid wallet public key.');
      }
      const signature = Buffer.from(signatureBase64, 'base64');
      if (signature.length !== nacl.sign.signatureLength) {
        throw new UnauthorizedException('Invalid wallet signature payload.');
      }

      return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        signature,
        publicKey,
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to verify wallet signature.');
    }
  }

  private assertFreshNonce(address: string, nonce: string): void {
    try {
      const decoded = Buffer.from(nonce, 'base64');
      if (!decoded.length) {
        throw new Error('empty');
      }
    } catch {
      throw new UnauthorizedException('Invalid nonce encoding.');
    }

    const ttlMs = Number(
      process.env.SESSION_NONCE_TTL_MS ?? DEFAULT_NONCE_TTL_MS,
    );
    const now = Date.now();
    const key = `${address}:${nonce}`;
    const expiresAt = SessionSecurityGuard.nonceCache.get(key);
    this.cleanupExpiredNonces(now);

    if (expiresAt && expiresAt > now) {
      throw new UnauthorizedException('Replay detected for wallet signature.');
    }

    SessionSecurityGuard.nonceCache.set(key, now + Math.max(ttlMs, 1000));
  }

  private cleanupExpiredNonces(now: number): void {
    for (const [key, expiresAt] of SessionSecurityGuard.nonceCache.entries()) {
      if (expiresAt <= now) {
        SessionSecurityGuard.nonceCache.delete(key);
      }
    }
  }

  private assertBodyWalletMatch(request: Request, walletAddress: string): void {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return;
    }

    const bodyWallet = (body as Record<string, unknown>).walletAddress;
    if (
      typeof bodyWallet === 'string' &&
      bodyWallet.trim() &&
      bodyWallet.trim() !== walletAddress
    ) {
      throw new UnauthorizedException('Wallet address mismatch.');
    }

    const sourceWallet = (body as Record<string, unknown>).sourceWalletAddress;
    if (
      typeof sourceWallet === 'string' &&
      sourceWallet.trim() &&
      sourceWallet.trim() !== walletAddress
    ) {
      throw new UnauthorizedException('Wallet address mismatch.');
    }
  }
}
