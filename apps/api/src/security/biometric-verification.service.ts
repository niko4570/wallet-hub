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
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MIN_CONFIDENCE = 0.7;

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

    if (!BASE64_REGEX.test(sanitizedProof)) {
      throw new BadRequestException('Biometric proof must be base64 encoded.');
    }

    let decodedPayload: string;
    try {
      decodedPayload = Buffer.from(sanitizedProof, 'base64').toString('utf8');
    } catch {
      throw new BadRequestException('Unable to decode biometric proof.');
    }

    let parsed: RawBiometricProof;
    try {
      parsed = JSON.parse(decodedPayload) as RawBiometricProof;
    } catch {
      throw new BadRequestException('Biometric proof payload is invalid JSON.');
    }

    const method =
      typeof parsed.method === 'string' && parsed.method.length > 0
        ? parsed.method
        : null;
    const deviceId =
      typeof parsed.deviceId === 'string' && parsed.deviceId.length > 0
        ? parsed.deviceId
        : context.devicePublicKey;
    const confidence =
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
        ? parsed.confidence
        : null;
    const issuedAt =
      typeof parsed.issuedAt === 'string' ? parsed.issuedAt : null;

    if (!method || confidence === null || !issuedAt) {
      throw new BadRequestException('Biometric proof is missing fields.');
    }

    const maxAgeMs = Number(
      process.env.BIOMETRIC_PROOF_MAX_AGE_MS ?? DEFAULT_MAX_AGE_MS,
    );
    const minConfidence = Number(
      process.env.BIOMETRIC_PROOF_MIN_CONFIDENCE ?? DEFAULT_MIN_CONFIDENCE,
    );

    const issuedAtMs = Date.parse(issuedAt);
    if (Number.isNaN(issuedAtMs)) {
      throw new BadRequestException('Biometric proof issuedAt is invalid.');
    }

    const ageMs = Date.now() - issuedAtMs;
    if (ageMs < 0 || ageMs > maxAgeMs) {
      throw new BadRequestException('Biometric proof has expired.');
    }

    if (!Number.isFinite(minConfidence) || confidence < minConfidence) {
      throw new BadRequestException('Biometric confidence too low.');
    }

    return {
      method,
      deviceId,
      confidence,
      issuedAt,
      rawPayload: parsed,
    };
  }
}
