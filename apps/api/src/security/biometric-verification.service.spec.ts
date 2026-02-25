import { BadRequestException } from '@nestjs/common';
import { BiometricVerificationService } from './biometric-verification.service';

const encodePayload = (payload: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

describe('BiometricVerificationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('verifies valid proof and defaults deviceId', () => {
    const service = new BiometricVerificationService();
    const now = new Date().toISOString();
    const proof = encodePayload({
      method: 'face',
      confidence: 0.95,
      issuedAt: now,
    });

    const result = service.verifyProof(proof, {
      walletAddress: 'wallet-1',
      devicePublicKey: 'device-1',
    });

    expect(result.method).toBe('face');
    expect(result.deviceId).toBe('device-1');
    expect(result.confidence).toBe(0.95);
  });

  it('rejects expired proofs', () => {
    const service = new BiometricVerificationService();
    process.env.BIOMETRIC_PROOF_MAX_AGE_MS = '1000';
    const issuedAt = new Date(Date.now() - 10_000).toISOString();
    const proof = encodePayload({
      method: 'face',
      confidence: 0.9,
      issuedAt,
    });

    expect(() =>
      service.verifyProof(proof, {
        walletAddress: 'wallet-1',
        devicePublicKey: 'device-1',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects low confidence proofs', () => {
    const service = new BiometricVerificationService();
    process.env.BIOMETRIC_PROOF_MIN_CONFIDENCE = '0.8';
    const proof = encodePayload({
      method: 'face',
      confidence: 0.6,
      issuedAt: new Date().toISOString(),
    });

    expect(() =>
      service.verifyProof(proof, {
        walletAddress: 'wallet-1',
        devicePublicKey: 'device-1',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed payloads', () => {
    const service = new BiometricVerificationService();
    expect(() =>
      service.verifyProof('not-base64', {
        walletAddress: 'wallet-1',
        devicePublicKey: 'device-1',
      }),
    ).toThrow(BadRequestException);
  });
});
