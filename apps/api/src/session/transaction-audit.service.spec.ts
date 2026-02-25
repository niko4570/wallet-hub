import { TransactionAuditService } from './transaction-audit.service';

describe('TransactionAuditService', () => {
  it('records audit entries and caps list size', () => {
    const service = new TransactionAuditService();
    for (let i = 0; i < 30; i += 1) {
      service.record({
        signature: `sig-${i}`,
        sourceWalletAddress: 'wallet-1',
        destinationAddress: 'wallet-2',
        amountLamports: 1000,
        authorizationPrimitive: 'session-key',
      });
    }

    const list = service.list();
    expect(list.length).toBe(25);
    expect(list[0].signature).toBe('sig-29');
  });
});
