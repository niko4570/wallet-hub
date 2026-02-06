import { useCallback, useMemo, useState } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  transact,
  type AuthToken,
  type MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const CLUSTER = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const APP_IDENTITY = {
  name: 'WalletHub',
  uri: 'https://wallethub.app',
};

interface AccountMeta {
  address: string;
  label?: string;
}

interface UseSolanaResult {
  connect: () => Promise<AccountMeta | null>;
  disconnect: () => Promise<void>;
  sendSol: (recipient: string, amountSol: number) => Promise<string>;
  account: AccountMeta | null;
  connection: Connection;
  isAuthenticated: boolean;
}

export function useSolana(): UseSolanaResult {
  const [account, setAccount] = useState<AccountMeta | null>(null);
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);

  const connection = useMemo(() => new Connection(RPC_URL, 'confirmed'), []);

  const ensureWalletSession = useCallback(async () => {
    return transact(async (wallet: MobileWallet) => {
      const authorization = await wallet.authorize({
        cluster: CLUSTER,
        identity: APP_IDENTITY,
        auth_token: authToken ?? undefined,
      });
      setAuthToken(authorization.auth_token);
      const primaryAccount = authorization.accounts[0];
      setAccount({ address: primaryAccount.address, label: primaryAccount.label });
      return { wallet, primaryAccount } as const;
    });
  }, [authToken]);

  const connect = useCallback(async () => {
    try {
      const { primaryAccount } = await ensureWalletSession();
      return { address: primaryAccount.address, label: primaryAccount.label };
    } catch (error) {
      console.error('Wallet connect failed', error);
      throw error;
    }
  }, [ensureWalletSession]);

  const disconnect = useCallback(async () => {
    if (!authToken) return;
    try {
      await transact(async (wallet) => {
        await wallet.deauthorize({ auth_token: authToken });
      });
    } catch (error) {
      console.warn('Deauthorize failed (ignored)', error);
    } finally {
      setAuthToken(null);
      setAccount(null);
    }
  }, [authToken]);

  const sendSol = useCallback(
    async (recipientAddress: string, amountSol: number) => {
      if (!recipientAddress) {
        throw new Error('Recipient address is required');
      }
      if (amountSol <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      const { wallet, primaryAccount } = await ensureWalletSession();
      const senderPubkey = new PublicKey(primaryAccount.address);
      const recipientPubkey = new PublicKey(recipientAddress);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
      const transaction = new Transaction({
        blockhash,
        lastValidBlockHeight,
        feePayer: senderPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          lamports,
        })
      );

      const [signature] = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });
      return signature;
    },
    [connection, ensureWalletSession]
  );

  return {
    connect,
    disconnect,
    sendSol,
    account,
    connection,
    isAuthenticated: !!authToken,
  };
}
