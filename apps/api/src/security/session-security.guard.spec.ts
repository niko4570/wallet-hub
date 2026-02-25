import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { SessionSecurityGuard } from './session-security.guard';

const makeContext = (req: any, res: any = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  }) as any;

const buildSignature = ({
  method,
  baseUrl,
  path,
  nonce,
  body,
  keyPair,
}: {
  method: string;
  baseUrl: string;
  path: string;
  nonce: string;
  body: any;
  keyPair: nacl.SignKeyPair;
}) => {
  const bodyString = body ? JSON.stringify(body) : '';
  const bodyHash = createHash('sha256').update(bodyString, 'utf8').digest('hex');
  const canonical = `WalletHub|${method}|${baseUrl}${path}|${nonce}|${bodyHash}`;
  const signature = nacl.sign.detached(
    Buffer.from(canonical, 'utf8'),
    keyPair.secretKey,
  );
  return {
    bodyHash,
    signature: Buffer.from(signature).toString('base64'),
  };
};

describe('SessionSecurityGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    (SessionSecurityGuard as any).rateLimits.clear();
    (SessionSecurityGuard as any).nonceCache.clear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows simple GET requests without API key', () => {
    const guard = new SessionSecurityGuard();
    const req = {
      method: 'GET',
      headers: {},
      body: {},
      ip: '127.0.0.1',
    };
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it('rejects invalid API key', () => {
    process.env.SESSION_API_KEY = 'secret';
    const guard = new SessionSecurityGuard();
    const req = {
      method: 'GET',
      headers: {},
      body: {},
      ip: '127.0.0.1',
    };
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('enforces body size limit', () => {
    process.env.SESSION_MAX_BODY_BYTES = '10';
    const guard = new SessionSecurityGuard();
    const req = {
      method: 'GET',
      headers: {},
      body: { a: '12345678901' },
      ip: '127.0.0.1',
    };
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      BadRequestException,
    );
  });

  it('enforces rate limiting', () => {
    process.env.SESSION_RATE_LIMIT_MAX = '1';
    process.env.SESSION_RATE_LIMIT_WINDOW_MS = '60000';
    const guard = new SessionSecurityGuard();
    const req = {
      method: 'GET',
      headers: {},
      body: {},
      ip: '127.0.0.1',
    };
    expect(guard.canActivate(makeContext(req))).toBe(true);
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing wallet signature headers for POST', () => {
    const guard = new SessionSecurityGuard();
    const req = {
      method: 'POST',
      headers: {},
      body: { walletAddress: 'wallet-1' },
      baseUrl: '/session',
      path: '/issue',
      ip: '127.0.0.1',
    };
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid wallet signatures', () => {
    const guard = new SessionSecurityGuard();
    const keyPair = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keyPair.publicKey);
    const nonce = Buffer.from('nonce-1').toString('base64');
    const body = { walletAddress };
    const { bodyHash, signature } = buildSignature({
      method: 'POST',
      baseUrl: '/session',
      path: '/issue',
      nonce,
      body,
      keyPair,
    });

    const req = {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress,
        'x-wallet-nonce': nonce,
        'x-wallet-signature': signature,
        'x-wallet-body-hash': bodyHash,
      },
      body,
      baseUrl: '/session',
      path: '/issue',
      ip: '127.0.0.1',
    };

    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it('rejects replayed nonce', () => {
    const guard = new SessionSecurityGuard();
    const keyPair = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keyPair.publicKey);
    const nonce = Buffer.from('nonce-1').toString('base64');
    const body = { walletAddress };
    const { bodyHash, signature } = buildSignature({
      method: 'POST',
      baseUrl: '/session',
      path: '/issue',
      nonce,
      body,
      keyPair,
    });

    const req = {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress,
        'x-wallet-nonce': nonce,
        'x-wallet-signature': signature,
        'x-wallet-body-hash': bodyHash,
      },
      body,
      baseUrl: '/session',
      path: '/issue',
      ip: '127.0.0.1',
    };

    expect(guard.canActivate(makeContext(req))).toBe(true);
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects wallet/body mismatch', () => {
    const guard = new SessionSecurityGuard();
    const keyPair = nacl.sign.keyPair();
    const walletAddress = bs58.encode(keyPair.publicKey);
    const nonce = Buffer.from('nonce-2').toString('base64');
    const body = { walletAddress: 'different-wallet' };
    const { bodyHash, signature } = buildSignature({
      method: 'POST',
      baseUrl: '/session',
      path: '/issue',
      nonce,
      body,
      keyPair,
    });

    const req = {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress,
        'x-wallet-nonce': nonce,
        'x-wallet-signature': signature,
        'x-wallet-body-hash': bodyHash,
      },
      body,
      baseUrl: '/session',
      path: '/issue',
      ip: '127.0.0.1',
    };

    expect(() => guard.canActivate(makeContext(req))).toThrow(
      UnauthorizedException,
    );
  });
});
