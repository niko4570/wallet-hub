import {
  Connection,
  PublicKey,
  GetProgramAccountsConfig,
} from "@solana/web3.js";
import { HELIUS_RPC_URL } from "../config/env";

class RpcService {
  private static instance: RpcService;
  private connection: Connection;
  private balanceCache: Map<string, { balance: number; timestamp: number }> =
    new Map();
  private transactionCache: Map<
    string,
    { transaction: any; timestamp: number }
  > = new Map();
  private cacheTTL = 30000; // 30 seconds
  private maxRetries = 3;

  private constructor() {
    this.connection = new Connection(HELIUS_RPC_URL, "confirmed");
  }

  static getInstance(): RpcService {
    if (!RpcService.instance) {
      RpcService.instance = new RpcService();
    }
    return RpcService.instance;
  }

  /**
   * Get Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get balance for a single address
   * @param address Wallet address
   * @returns Balance in lamports
   */
  async getBalance(address: string): Promise<number> {
    // Check cache first
    const cached = this.balanceCache.get(address);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.balance;
    }

    try {
      const publicKey = new PublicKey(address);
      const balance = await this.retry(async () => {
        return await this.connection.getBalance(publicKey);
      });

      // Update cache
      this.balanceCache.set(address, {
        balance,
        timestamp: Date.now(),
      });

      return balance;
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw error;
    }
  }

  /**
   * Get balances for multiple addresses
   * @param addresses Array of wallet addresses
   * @returns Object mapping addresses to balances
   */
  async getMultipleBalances(
    addresses: string[],
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const uncachedAddresses: string[] = [];

    // Check cache for each address
    for (const address of addresses) {
      const cached = this.balanceCache.get(address);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
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
   * Get transaction details
   * @param signature Transaction signature
   * @returns Transaction details
   */
  async getTransaction(signature: string): Promise<any> {
    // Check cache first
    const cached = this.transactionCache.get(signature);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.transaction;
    }

    try {
      const transaction = await this.retry(async () => {
        return await this.connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
      });

      // Update cache
      this.transactionCache.set(signature, {
        transaction,
        timestamp: Date.now(),
      });

      return transaction;
    } catch (error) {
      console.error("Error fetching transaction:", error);
      throw error;
    }
  }

  /**
   * Get transaction signatures for an address
   * @param address Wallet address
   * @param limit Maximum number of signatures to return
   * @param before Optional signature to start from
   * @returns Array of transaction signatures
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
   * Get program accounts
   * @param programId Program public key
   * @param config Optional configuration
   * @returns Array of program accounts
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
   * Get token accounts for an owner
   * @param owner Owner public key
   * @param mint Optional mint public key
   * @returns Array of token accounts
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
   * Get recent blockhash
   * @returns Recent blockhash and last valid block height
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
   * Refresh cache for a specific address
   * @param address Wallet address
   */
  async refreshCache(address: string): Promise<void> {
    this.balanceCache.delete(address);
    await this.getBalance(address);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.balanceCache.clear();
    this.transactionCache.clear();
  }

  /**
   * Retry function with exponential backoff
   * @param fn Function to retry
   * @param retries Number of retries
   * @returns Result of the function
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
