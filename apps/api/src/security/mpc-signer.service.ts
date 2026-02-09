import { BadRequestException, Injectable } from '@nestjs/common';
import { SessionPolicy, SessionScope } from '@wallethub/contracts';
import { randomUUID } from 'crypto';

export interface MpcSignatureResult {
  signatureId: string;
  approvedScopes: SessionScope[];
  expiresAt: string;
  approvals: {
    type: 'biometric' | 'policy';
    detail: string;
  }[];
}

export interface MpcSignatureRequest {
  walletAddress: string;
  scopes: SessionScope[];
  policy: SessionPolicy;
  biometricConfidence: number;
  expiresInMinutes: number;
}

@Injectable()
export class MpcSignerService {
  authorizeAndSign(request: MpcSignatureRequest): MpcSignatureResult {
    if (request.scopes.length === 0) {
      throw new BadRequestException('At least one scope must be provided.');
    }

    if (request.biometricConfidence < 0.5) {
      throw new BadRequestException(
        'Biometric confidence too low for MPC approval.',
      );
    }

    this.assertPolicyCompliance(request.scopes, request.policy);

    const expiresAt = new Date(
      Date.now() + request.expiresInMinutes * 60 * 1000,
    ).toISOString();

    return {
      signatureId: `mpc-signature-${randomUUID()}`,
      approvedScopes: request.scopes,
      expiresAt,
      approvals: [
        {
          type: 'biometric',
          detail: `confidence:${request.biometricConfidence}`,
        },
        {
          type: 'policy',
          detail: `policy:${request.policy.id}`,
        },
      ],
    };
  }

  private assertPolicyCompliance(
    scopes: SessionScope[],
    policy: SessionPolicy,
  ) {
    const totalRequested = scopes.reduce(
      (sum, scope) => sum + (scope.maxUsd ?? policy.maxDailySpendUsd),
      0,
    );
    if (totalRequested > policy.maxDailySpendUsd) {
      throw new BadRequestException(
        'Requested scope exceeds policy daily spend limit.',
      );
    }

    if (policy.allowedPrograms.length > 0) {
      scopes.forEach((scope) => {
        (scope.programs ?? []).forEach((program) => {
          if (!policy.allowedPrograms.includes(program)) {
            throw new BadRequestException(
              `Program ${program} is not allowed by policy ${policy.id}.`,
            );
          }
        });
      });
    }

    if (policy.allowedDestinations.length > 0) {
      scopes.forEach((scope) => {
        (scope.destinations ?? []).forEach((destination) => {
          if (!policy.allowedDestinations.includes(destination)) {
            throw new BadRequestException(
              `Destination ${destination} is not allowed by policy ${policy.id}.`,
            );
          }
        });
      });
    }
  }
}
