import type { ChainId, TokenAsset } from "../../types";
import { fetchSolanaAssets } from "../solana/solanaProvider";

/**
 * Fetches token assets for a specific wallet address on the given blockchain network.
 * This function serves as a router that delegates to the appropriate blockchain-specific
 * implementation based on the chain ID.
 *
 * @param chain - The blockchain network identifier (e.g., "solana:mainnet-beta", "solana:devnet")
 * @param address - The wallet address to fetch assets for
 * @returns Promise resolving to an array of token assets with their balances and metadata
 * @throws {Error} If the specified chain is not supported
 *
 * @example
 * ```typescript
 * const assets = await fetchAssets("solana:mainnet-beta", "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
 * console.log(assets); // [{ mint: "...", symbol: "SOL", balance: 1.5, ... }]
 * ```
 */
export async function fetchAssets(
  chain: ChainId,
  address: string,
): Promise<TokenAsset[]> {
  switch (chain) {
    case "solana:mainnet-beta":
    case "solana:devnet":
    case "solana:testnet":
      return fetchSolanaAssets(address);
    default:
      throw new Error(`chain not supported: ${chain}`);
  }
}
