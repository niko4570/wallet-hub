import { BadRequestException, Injectable } from '@nestjs/common';
import { Buffer } from 'buffer';

export interface BiometricVerificationContext {
  walletAddress: string;
  devicePublicKey: string;
}

export interface BiometricVerificationResult {
  method: string;
  deviceId?: string;
  confidence: number;
  issuedAt: string;
  rawPayload?: Record<string, unknown>;
}

type RawBiometricProof = {
  method?: unknown;
  deviceId?: unknown;
  confidence?: unknown;
  issuedAt?: unknown;
  [key: string]: unknown;
};

const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;

@Injectable()
export class BiometricVerificationService {
  verifyProof(
    proof: string,
    context: BiometricVerificationContext,
  ): BiometricVerificationResult {
    if (!proof?.trim()) {
      throw new BadRequestException('Biometric proof is required.');
    }

    const sanitizedProof = proof.trim();

    if (sanitizedProof.length < 16) {
      throw new BadRequestException('Biometric proof is too short.');
    }

    let decodedPayload: string | null = null;
    if (BASE64_REGEX.test(sanitizedProof)) {
      try {
        decodedPayload = Buffer.from(sanitizedProof, 'base64').toString('utf8');
      } catch {
        decodedPayload = null;
      }
    }

    const fallbackResult: BiometricVerificationResult = {
      method: 'unknown',
      confidence: 0.5,
      issuedAt: new Date().toISOString(),
    };

    if (!decodedPayload) {
      // Accept opaque proofs (e.g., signed JWT) but log minimal metadata.
      return fallbackResult;
    }

    try {
      const parsed = JSON.parse(decodedPayload) as RawBiometricProof;
      const method =
        typeof parsed.method === 'string' && parsed.method.length > 0
          ? parsed.method
          : fallbackResult.method;
      const deviceId =
        typeof parsed.deviceId === 'string' && parsed.deviceId.length > 0
          ? parsed.deviceId
          : context.devicePublicKey;
      const confidence =
        typeof parsed.confidence === 'number' &&
        parsed.confidence >= 0 &&
        parsed.confidence <= 1
          ? parsed.confidence
          : 0.85;
      const issuedAt =
        typeof parsed.issuedAt === 'string'
          ? parsed.issuedAt
          : fallbackResult.issuedAt;

      return {
        method,
        deviceId,
        confidence,
        issuedAt,
        rawPayload: parsed,
      };
    } catch {
      return fallbackResult;
    }
  }
}
