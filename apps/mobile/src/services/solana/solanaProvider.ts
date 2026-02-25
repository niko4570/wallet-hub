import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { rpcService } from "./rpcService";
import { priceService } from "../api/priceService";
import { tokenMetadataService } from "../api/tokenMetadataService";
import { SOLANA_CLUSTER } from "../../config/env";
import type { TokenAsset, ChainId } from "../../types";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
);
const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

// Jupiter V2 API doesn't have /all endpoint
// Token metadata will be fetched via tokenMetadataService

type JupiterTokenListEntry = {
  address?: string;
  mint?: string;
  symbol?: string;
  logoURI?: string;
  decimals?: number;
  liquidity?: number;
  liquidityUsd?: number;
};

type ParsedTokenAccount = {
  mint: string;
  uiAmount: number;
  decimals: number;
};

const parseTokenAccounts = (value: any[]): ParsedTokenAccount[] => {
  return value
    .map((entry) => {
      const info = entry?.account?.data?.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      const mint = info?.mint;
      if (!tokenAmount || !mint) {
        return null;
      }
      const uiAmount =
        typeof tokenAmount.uiAmount === "number"
          ? tokenAmount.uiAmount
          : Number(tokenAmount.uiAmountString ?? "0");
      const decimals =
        typeof tokenAmount.decimals === "number" ? tokenAmount.decimals : 0;

      return {
        mint,
        uiAmount,
        decimals,
      };
    })
    .filter((entry): entry is ParsedTokenAccount => entry !== null);
};

const getTokenListMap = async (): Promise<
  Record<string, JupiterTokenListEntry>
> => {
  // Jupiter V2 API doesn't have /all endpoint
  // Token metadata will be fetched via tokenMetadataService
  return {};
};

export async function fetchSolanaAssets(
  address: string,
): Promise<TokenAsset[]> {
  const owner = new PublicKey(address);
  const connection = rpcService.getConnection();

  const [lamports, legacyAccounts, token2022Accounts] = await Promise.all([
    rpcService.getBalance(address).catch((error) => {
      console.warn("Failed to fetch SOL balance for allocation", error);
      return 0;
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
  ]);

  const parsedAccounts = [
    ...parseTokenAccounts(legacyAccounts.value),
    ...parseTokenAccounts(token2022Accounts.value),
  ].filter((token) => token.uiAmount > 0);

  const assets: TokenAsset[] = [];
  if (lamports > 0) {
    const solBalance = lamports / LAMPORTS_PER_SOL;
    const solPrice = await priceService.getSolPriceInUsd().catch((error) => {
      console.warn("Failed to fetch SOL price for allocation", error);
      return 0;
    });
    const solUsdValue = solBalance * solPrice;
    if (solUsdValue > 0) {
      assets.push({
        chain: SOLANA_CLUSTER as ChainId,
        mint: NATIVE_SOL_MINT,
        symbol: "SOL",
        amount: solBalance,
        usdValue: solUsdValue,
        priceUsd: solPrice || undefined,
      });
    }
  }

  if (parsedAccounts.length === 0) {
    return assets;
  }

  const mints = Array.from(new Set(parsedAccounts.map((token) => token.mint)));
  
  const [tokenBalances, priceMap] = await Promise.all([
    tokenMetadataService.getTokenBalancesForWallet(address).catch((error) => {
      console.warn("Failed to fetch token metadata", error);
      return [];
    }),
    priceService.getTokenPricesInUsd(mints),
  ]);

  // Create a map of token metadata by mint
  const tokenMetadataMap = tokenBalances.reduce(
    (acc, token) => {
      acc[token.mint] = token;
      return acc;
    },
    {} as Record<string, (typeof tokenBalances)[0]>,
  );

  const tokenAssets = parsedAccounts
    .map((token) => {
      const price = priceMap[token.mint];
      const metadata = tokenMetadataMap[token.mint];
      const symbol = metadata?.symbol ?? token.mint;
      const liquidityValue = metadata?.usdValue;

      let usdValue: number;
      let priceUsd: number | undefined;

      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        usdValue = token.uiAmount * price;
        priceUsd = price;
      } else {
        // If no price from price service, use metadata's usdValue or 0
        usdValue = metadata?.usdValue || 0;
        priceUsd = undefined;
      }

      // Only include assets with positive value
      if (usdValue <= 0) {
        return null;
      }

      const asset: TokenAsset = {
        chain: SOLANA_CLUSTER as ChainId,
        mint: token.mint,
        symbol: symbol as string,
        amount: token.uiAmount,
        usdValue,
        priceUsd,
        liquidityUsd: liquidityValue,
      };

      return asset;
    })
    .filter((entry): entry is TokenAsset => entry !== null);

  return assets.concat(tokenAssets);
}
