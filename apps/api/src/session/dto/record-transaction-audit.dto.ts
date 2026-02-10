import type {
  AuthorizationPrimitive,
  TransactionAuditStatus,
} from '@wallethub/contracts';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

const AUTHORIZATION_PRIMITIVES: AuthorizationPrimitive[] = [
  'silent-reauthorization',
  'session-key',
];

const AUDIT_STATUSES: TransactionAuditStatus[] = ['submitted', 'failed'];

export class RecordTransactionAuditDto {
  @IsString()
  signature!: string;

  @IsString()
  sourceWalletAddress!: string;

  @IsString()
  destinationAddress!: string;

  @IsNumber()
  amountLamports!: number;

  @IsIn(AUTHORIZATION_PRIMITIVES)
  authorizationPrimitive!: AuthorizationPrimitive;

  @IsOptional()
  @IsIn(AUDIT_STATUSES)
  status?: TransactionAuditStatus;

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}
