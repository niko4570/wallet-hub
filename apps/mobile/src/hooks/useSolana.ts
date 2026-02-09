import { useCallback, useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  transact,
  type Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import { HELIUS_RPC_URL, SOLANA_CLUSTER } from "../config/env";

const APP_IDENTITY = {
  name: "WalletHub",
  uri: "https://wallethub.app",
};

/**
 * Normalize wallet addresses emitted from Mobile Wallet Adapter.
 * Some wallets return base64-encoded 32 byte buffers, others return base58 strings.
 */
const decodeWalletAddress = (rawAddress: string): string => {
  const trimmed = rawAddress.trim();
  const attempts: Error[] = [];

  const tryPublicKey = (input: Buffer | string) => {
    const pubkey = new PublicKey(input);
    return pubkey.toBase58();
  };

  try {
    const asBase64 = Buffer.from(trimmed, "base64");
    if (asBase64.length === 32) {
      return tryPublicKey(asBase64);
    }
  } catch (error) {
    attempts.push(error as Error);
  }

  try {
    return tryPublicKey(trimmed);
  } catch (error) {
    attempts.push(error as Error);
    console.error("Wallet provided invalid address", attempts);
    throw new Error("Wallet returned an invalid address.");
  }
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
  balanceLamports: number | null;
  refreshBalance: () => Promise<number | null>;
}

/**
 * Shared Solana adapter hook that wraps Mobile Wallet Adapter authorization
 * and exposes helpers for connecting, disconnecting, sending, and refreshing balances.
 */
export function useSolana(): UseSolanaResult {
  const [account, setAccount] = useState<AccountMeta | null>(null);
  const [authToken, setAuthToken] = useState<any | null>(null);
  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);

  const connection = useMemo(
    () => new Connection(HELIUS_RPC_URL, "confirmed"),
    [HELIUS_RPC_URL],
  );

  const refreshBalance = useCallback(async () => {
    if (!account?.address) {
      setBalanceLamports(null);
      return null;
    }
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(account.address);
    } catch (error) {
      console.warn("Invalid account address when refreshing balance", error);
      setBalanceLamports(null);
      throw error;
    }
    const balance = await connection.getBalance(publicKey);
    setBalanceLamports(balance);
    return balance;
  }, [account, connection]);

  const ensureWalletSession = useCallback(async () => {
    return transact(async (wallet: Web3MobileWallet) => {
      let authorization;
      if (authToken) {
        // Re-use prior auth token so wallets avoid re-prompting the user.
        authorization = await wallet.authorize({
          identity: APP_IDENTITY,
          auth_token: authToken,
        });
      } else {
        authorization = await wallet.authorize({
          identity: APP_IDENTITY,
          chain: SOLANA_CLUSTER,
        });
      }
      setAuthToken(authorization.auth_token);
      const accountFromWallet = authorization.accounts[0];
      const normalizedAccount = {
        ...accountFromWallet,
        address: decodeWalletAddress(accountFromWallet.address),
      };
      setAccount({
        address: normalizedAccount.address,
        label: normalizedAccount.label,
      });
      setBalanceLamports(null);
      return { wallet, primaryAccount: normalizedAccount } as const;
    });
  }, [authToken]);

  useEffect(() => {
    if (account?.address) {
      refreshBalance().catch((err) => {
        console.warn("Balance refresh failed", err);
      });
    } else {
      setBalanceLamports(null);
    }
  }, [account, refreshBalance]);

  const connect = useCallback(async () => {
    try {
      const { primaryAccount } = await ensureWalletSession();
      return { address: primaryAccount.address, label: primaryAccount.label };
    } catch (error) {
      console.error("Wallet connect failed", error);
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
      console.warn("Deauthorize failed (ignored)", error);
    } finally {
      setAuthToken(null);
      setAccount(null);
      setBalanceLamports(null);
    }
  }, [authToken]);

  const sendSol = useCallback(
    async (recipientAddress: string, amountSol: number) => {
      if (!recipientAddress) {
        throw new Error("Recipient address is required");
      }
      if (amountSol <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      const { wallet, primaryAccount } = await ensureWalletSession();
      const senderPubkey = new PublicKey(primaryAccount.address);
      const recipientPubkey = new PublicKey(recipientAddress);

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
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
        }),
      );

      const [signature] = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });
      return signature;
    },
    [connection, ensureWalletSession],
  );

  return {
    connect,
    disconnect,
    sendSol,
    account,
    connection,
    isAuthenticated: !!authToken,
    balanceLamports,
    refreshBalance,
  };
}
