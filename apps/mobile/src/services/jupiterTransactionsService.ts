import { jupiterService } from "./jupiterService";

const TRANSACTIONS_ENDPOINT = "/portfolio/v1/transactions";
const DEFAULT_LIMIT = 40;

export interface JupiterTransactionRecord {
  signature?: string;
  txSignature?: string;
  transactionSignature?: string;
  timestamp?: number;
  blockTime?: number;
  type?: string;
  action?: string;
  description?: string;
  label?: string;
  platform?: string;
  dex?: string;
  programId?: string;
  inputMint?: string;
  outputMint?: string;
  inputSymbol?: string;
  outputSymbol?: string;
  inputAmount?: number;
  outputAmount?: number;
  inputDecimals?: number;
  outputDecimals?: number;
  amountUsd?: number;
  volumeUsd?: number;
  pnlUsd?: number;
  feeUsd?: number;
  data?: Record<string, unknown>;
}

const extractTransactions = (payload: any): any[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.transactions)) {
    return payload.transactions;
  }
  if (Array.isArray(payload.data?.transactions)) {
    return payload.data.transactions;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
};

export async function fetchJupiterTransactions(
  address: string,
  limit: number = DEFAULT_LIMIT,
): Promise<JupiterTransactionRecord[]> {
  if (!address) {
    return [];
  }

  try {
    const payload = await jupiterService.requestJson(TRANSACTIONS_ENDPOINT, {
      method: "POST",
      body: {
        wallet: address,
        limit,
      },
      cacheKey: `jupiter-transactions:${address}:${limit}`,
      cacheTtlMs: 30 * 1000,
    });
    return extractTransactions(payload);
  } catch (error) {
    console.warn("Failed to fetch Jupiter transactions", error);
    return [];
  }
}

export const jupiterTransactionsService = {
  fetchTransactions: fetchJupiterTransactions,
};
