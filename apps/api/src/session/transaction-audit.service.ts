import {
  RecordTransactionAuditPayload,
  TransactionAuditEntry,
} from '@wallethub/contracts';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class TransactionAuditService {
  private audits: TransactionAuditEntry[] = [];

  list(): TransactionAuditEntry[] {
    return this.audits;
  }

  record(payload: RecordTransactionAuditPayload): TransactionAuditEntry {
    const entry: TransactionAuditEntry = {
      id: randomUUID(),
      signature: payload.signature,
      sourceWalletAddress: payload.sourceWalletAddress,
      destinationAddress: payload.destinationAddress,
      amountLamports: payload.amountLamports,
      authorizationPrimitive: payload.authorizationPrimitive,
      status: payload.status ?? 'submitted',
      failureReason: payload.failureReason,
      metadata: payload.metadata,
      recordedAt: new Date().toISOString(),
    };

    this.audits = [entry, ...this.audits].slice(0, 25);
    return entry;
  }
}
