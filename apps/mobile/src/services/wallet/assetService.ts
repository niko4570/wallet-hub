import type { ChainId, TokenAsset } from "../../types";
import { fetchSolanaAssets } from "../solana/solanaProvider";

export async function fetchAssets(
  chain: ChainId,
  address: string,
): Promise<TokenAsset[]> {
  switch (chain) {
    case "solana:mainnet-beta":
      return fetchSolanaAssets(address);
    default:
      throw new Error(`chain not supported: ${chain}`);
  }
}
