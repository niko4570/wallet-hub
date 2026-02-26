import {
  Connection,
  PublicKey,
  GetProgramAccountsConfig,
} from "@solana/web3.js";
import { SOLANA_RPC_URL, HELIUS_API_KEY } from "../../config/env";
import { SecureConnection, SecureRpcConfig } from "./secureConnection";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);

export interface ParsedTokenAccountBalance {
  mint: string;
  decimals: number;
  amount: string;
  uiAmount: number;
}

/**
 * RPC service for interacting with Solana blockchain.
 * Provides a singleton instance with caching, request deduplication,
 * and automatic retry logic for improved performance and reliability.
 *
 * Features:
 * - Balance caching with configurable TTL
 * - Request deduplication to prevent duplicate calls
 * - Automatic retry with exponential backoff
 * - Support for both Token Program and Token-2022 Program
 * - Transaction and token account caching
 */
class RpcService {
  private static instance: RpcService;
  private connection: SecureConnection;
  private balanceCache: Map<string, { balance: number; timestamp: number }> =
    new Map();
  private transactionCache: Map<
    string,
    { transaction: any; timestamp: number }
  > = new Map();
  private tokenAccountsCache: Map<
    string,
    { accounts: ParsedTokenAccountBalance[]; timestamp: number }
  > = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private cacheTTL: {
    balance: number;
    transaction: number;
    tokenAccounts: number;
  } = {
    balance: 30000,
    transaction: 60000,
    tokenAccounts: 45000,
  };
  private maxRetries = 3;

  private constructor() {
    const config = HELIUS_API_KEY ? { apiKey: HELIUS_API_KEY } : undefined;
    this.connection = new SecureConnection(SOLANA_RPC_URL, config);
  }

  /**
   * Gets the singleton instance of RpcService.
   * Creates a new instance if one doesn't exist.
   *
   * @returns The RpcService singleton instance
   */
  static getInstance(): RpcService {
    if (!RpcService.instance) {
      RpcService.instance = new RpcService();
    }
    return RpcService.instance;
  }

  /**
   * Gets the current Solana connection instance.
   *
   * @returns The Solana Connection object
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Sets a new Solana connection and clears all caches.
   * This should be called when switching networks or RPC endpoints.
   *
   * @param connection - The new Connection object to use
   */
  setConnection(connection: SecureConnection): void {
    this.connection = connection;
    // Clear cache when connection changes
    this.clearCache();
  }

  /**
   * Gets the SOL balance for a single wallet address.
   * Uses caching to avoid redundant RPC calls.
   *
   * @param address - The wallet address to check
   * @returns Promise resolving to balance in lamports
   * @throws {Error} If fetching balance fails
   *
   * @example
   * ```typescript
   * const balance = await rpcService.getBalance("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * console.log(`Balance: ${balance} lamports`);
   * ```
   */
  async getBalance(address: string): Promise<number> {
    const cached = this.balanceCache.get(address);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL.balance) {
      return cached.balance;
    }

    return this.deduplicateRequest(`balance:${address}`, async () => {
      try {
        const publicKey = new PublicKey(address);
        const balance = await this.retry(async () => {
          return await this.connection.getBalance(publicKey);
        });

        this.balanceCache.set(address, {
          balance,
          timestamp: Date.now(),
        });

        return balance;
      } catch (error) {
        console.error("Error fetching balance:", error);
        throw error;
      }
    });
  }

  /**
   * Gets balances for multiple wallet addresses in a single batch request.
   * More efficient than calling getBalance for each address individually.
   *
   * @param addresses - Array of wallet addresses to check
   * @returns Promise resolving to object mapping addresses to balances
   *
   * @example
   * ```typescript
   * const balances = await rpcService.getMultipleBalances([
   *   "addr1...",
   *   "addr2..."
   * ]);
   * console.log(balances);
   * // { "addr1...": 1000000, "addr2...": 2000000 }
   * ```
   */
  async getMultipleBalances(
    addresses: string[],
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const uncachedAddresses: string[] = [];

    // Check cache for each address
    for (const address of addresses) {
      const cached = this.balanceCache.get(address);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL.balance) {
        result[address] = cached.balance;
      } else {
        uncachedAddresses.push(address);
      }
    }

    // Fetch uncached balances in bulk
    if (uncachedAddresses.length > 0) {
      try {
        const publicKeys = uncachedAddresses.map((addr) => new PublicKey(addr));
        const accounts = await this.retry(async () => {
          return await this.connection.getMultipleAccountsInfo(publicKeys);
        });

        for (let i = 0; i < uncachedAddresses.length; i++) {
          const address = uncachedAddresses[i];
          const account = accounts[i];
          const balance = account?.lamports || 0;

          result[address] = balance;

          // Update cache
          this.balanceCache.set(address, {
            balance,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error("Error fetching multiple balances:", error);
        // Fallback to individual requests
        for (const address of uncachedAddresses) {
          try {
            result[address] = await this.getBalance(address);
          } catch {
            result[address] = 0;
          }
        }
      }
    }

    return result;
  }

  /**
   * Gets transaction details by signature.
   * Uses caching to avoid redundant RPC calls for the same transaction.
   *
   * @param signature - The transaction signature to fetch
   * @returns Promise resolving to parsed transaction details
   * @throws {Error} If fetching transaction fails
   *
   * @example
   * ```typescript
   * const tx = await rpcService.getTransaction("5H7vX...");
   * console.log(tx);
   * ```
   */
  async getTransaction(signature: string): Promise<any> {
    const cached = this.transactionCache.get(signature);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL.transaction) {
      return cached.transaction;
    }

    return this.deduplicateRequest(`transaction:${signature}`, async () => {
      try {
        const transaction = await this.retry(async () => {
          return await this.connection.getParsedTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });
        });

        this.transactionCache.set(signature, {
          transaction,
          timestamp: Date.now(),
        });

        return transaction;
      } catch (error) {
        console.error("Error fetching transaction:", error);
        throw error;
      }
    });
  }

  /**
   * Gets transaction signatures for a wallet address.
   * Useful for fetching transaction history.
   *
   * @param address - The wallet address to fetch signatures for
   * @param limit - Maximum number of signatures to return (default: 10)
   * @param before - Optional signature to start from (for pagination)
   * @returns Promise resolving to array of transaction signatures
   * @throws {Error} If fetching signatures fails
   *
   * @example
   * ```typescript
   * const signatures = await rpcService.getSignaturesForAddress(
   *   "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
   *   20
   * );
   * ```
   */
  async getSignaturesForAddress(
    address: string,
    limit = 10,
    before?: string,
  ): Promise<any[]> {
    try {
      const publicKey = new PublicKey(address);
      return await this.retry(async () => {
        return await this.connection.getSignaturesForAddress(publicKey, {
          limit,
          before,
        });
      });
    } catch (error) {
      console.error("Error fetching signatures:", error);
      throw error;
    }
  }

  /**
   * Gets all program accounts for a given program ID.
   * Useful for querying custom programs on Solana.
   *
   * @param programId - The program's public key
   * @param config - Optional configuration for filtering accounts
   * @returns Promise resolving to array of program accounts
   * @throws {Error} If fetching program accounts fails
   *
   * @example
   * ```typescript
   * const programId = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
   * const accounts = await rpcService.getProgramAccounts(programId);
   * ```
   */
  async getProgramAccounts(
    programId: PublicKey,
    config?: GetProgramAccountsConfig,
  ): Promise<any[]> {
    try {
      const result = await this.retry(async () => {
        return await this.connection.getProgramAccounts(programId, config);
      });
      return Array.from(result);
    } catch (error) {
      console.error("Error fetching program accounts:", error);
      throw error;
    }
  }

  /**
   * Gets token accounts for an owner address.
   * Queries the Token Program for all token accounts owned by the address.
   *
   * @param owner - The owner's public key
   * @param mint - Optional mint address to filter by
   * @returns Promise resolving to array of token accounts
   * @throws {Error} If fetching token accounts fails
   *
   * @example
   * ```typescript
   * const owner = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * const accounts = await rpcService.getTokenAccountsByOwner(owner);
   * ```
   */
  async getTokenAccountsByOwner(
    owner: PublicKey,
    mint?: PublicKey,
  ): Promise<any[]> {
    try {
      const result = await this.retry(async () => {
        if (mint) {
          return await this.connection.getTokenAccountsByOwner(owner, {
            mint,
          });
        } else {
          return await this.connection.getTokenAccountsByOwner(owner, {
            programId: new PublicKey(
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            ),
          });
        }
      });
      return Array.from(result.value);
    } catch (error) {
      console.error("Error fetching token accounts:", error);
      throw error;
    }
  }

  /**
   * Gets parsed token accounts for an owner address.
   * Returns token balances with decoded amounts and metadata.
   * Queries both Token Program and Token-2022 Program.
   *
   * @param owner - The owner's public key
   * @returns Promise resolving to array of parsed token balances
   * @throws {Error} If fetching parsed token accounts fails
   *
   * @example
   * ```typescript
   * const owner = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * const balances = await rpcService.getParsedTokenAccountsByOwner(owner);
   * console.log(balances);
   * // [{ mint: "...", decimals: 9, amount: "1000000000", uiAmount: 1.0 }]
   * ```
   */
  async getParsedTokenAccountsByOwner(
    owner: PublicKey,
  ): Promise<ParsedTokenAccountBalance[]> {
    const ownerKey = owner.toString();
    const cached = this.tokenAccountsCache.get(ownerKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL.tokenAccounts) {
      return cached.accounts;
    }

    return this.deduplicateRequest(`tokenAccounts:${ownerKey}`, async () => {
      try {
        const [legacyResult, token2022Result] = await Promise.all([
          this.retry(async () => {
            return await this.connection.getParsedTokenAccountsByOwner(owner, {
              programId: TOKEN_PROGRAM_ID,
            });
          }),
          this.retry(async () => {
            return await this.connection.getParsedTokenAccountsByOwner(owner, {
              programId: TOKEN_2022_PROGRAM_ID,
            });
          }),
        ]);

        const combined = [...legacyResult.value, ...token2022Result.value];

        const result = combined
          .map((entry) => {
            const info = entry.account.data.parsed?.info;
            const tokenAmount = info?.tokenAmount;
            const mint = info?.mint;
            if (!tokenAmount || !mint) {
              return null;
            }

            const decimals =
              typeof tokenAmount.decimals === "number"
                ? tokenAmount.decimals
                : 0;
            const amount =
              typeof tokenAmount.amount === "string" ? tokenAmount.amount : "0";
            const uiAmount =
              typeof tokenAmount.uiAmount === "number"
                ? tokenAmount.uiAmount
                : Number(tokenAmount.uiAmountString ?? "0");

            return {
              mint,
              decimals,
              amount,
              uiAmount,
            };
          })
          .filter(
            (entry): entry is ParsedTokenAccountBalance => entry !== null,
          );

        this.tokenAccountsCache.set(ownerKey, {
          accounts: result,
          timestamp: Date.now(),
        });

        return result;
      } catch (error) {
        console.error("Error fetching parsed token accounts:", error);
        throw error;
      }
    });
  }

  /**
   * Gets the latest blockhash and last valid block height.
   * Required for building and sending transactions.
   *
   * @returns Promise resolving to blockhash and last valid block height
   * @throws {Error} If fetching blockhash fails
   *
   * @example
   * ```typescript
   * const { blockhash, lastValidBlockHeight } = await rpcService.getLatestBlockhash();
   * console.log(`Blockhash: ${blockhash}, Valid until: ${lastValidBlockHeight}`);
   * ```
   */
  async getLatestBlockhash(): Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
  }> {
    try {
      return await this.retry(async () => {
        return await this.connection.getLatestBlockhash();
      });
    } catch (error) {
      console.error("Error fetching latest blockhash:", error);
      throw error;
    }
  }

  /**
   * Refreshes the cache for a specific wallet address.
   * Forces a fresh balance fetch from the RPC.
   *
   * @param address - The wallet address to refresh
   *
   * @example
   * ```typescript
   * await rpcService.refreshCache("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
   * ```
   */
  async refreshCache(address: string): Promise<void> {
    this.balanceCache.delete(address);
    await this.getBalance(address);
  }

  /**
   * Clears all cached data.
   * This should be called when switching networks or RPC endpoints.
   */
  clearCache(): void {
    this.balanceCache.clear();
    this.transactionCache.clear();
    this.tokenAccountsCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Deduplicates pending requests to avoid duplicate API calls.
   * If a request with the same key is already in flight,
   * returns the existing promise instead of starting a new one.
   *
   * @template T - The type of the promise result
   * @param key - A unique key identifying the request
   * @param requestFn - The function to execute if not already pending
   * @returns Promise resolving to the result
   */
  private async deduplicateRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Retries a function with exponential backoff on failure.
   * Implements a retry mechanism with increasing delay between attempts.
   *
   * @template T - The type of the promise result
   * @param fn - The function to retry
   * @param retries - Number of retry attempts (default: 3)
   * @returns Promise resolving to the result
   * @throws {Error} If all retry attempts fail
   */
  private async retry<T>(
    fn: () => Promise<T>,
    retries = this.maxRetries,
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Retry ${i + 1}/${retries} failed:`, lastError.message);

        // Exponential backoff
        if (i < retries - 1) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }
}

export const rpcService = RpcService.getInstance();
