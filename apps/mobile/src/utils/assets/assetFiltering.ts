import type { TokenAsset } from "../../types";
import { SOLANA_CLUSTER } from "../../config/env";

export type AssetFilterResult = {
  verified: TokenAsset[];
  hidden: TokenAsset[];
};

export type AssetFilterOptions = {
  liquidityThresholdUsd?: number;
};

const SOL_MINTS = new Set([
  "So11111111111111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
]);

const isSolToken = (asset: TokenAsset): boolean => {
  if (asset.chain !== SOLANA_CLUSTER) {
    return false;
  }
  if (asset.symbol === "SOL") {
    return true;
  }
  return SOL_MINTS.has(asset.mint);
};

const isSuspiciousSymbol = (symbol: string | undefined): boolean => {
  if (!symbol) {
    return true;
  }

  const trimmed = symbol.trim();
  if (trimmed.length < 2) {
    return true;
  }

  const normalized = trimmed.toUpperCase();
  const cleaned = normalized.replace(/[^A-Z0-9]/g, "");

  if (cleaned.length < 2) {
    return true;
  }
  if (cleaned.length > 12) {
    return true;
  }

  const digits = cleaned.replace(/[^0-9]/g, "").length;
  if (digits >= 4 && digits / cleaned.length > 0.5) {
    return true;
  }

  const hasVowel = /[AEIOU]/.test(cleaned);
  if (!hasVowel && cleaned.length >= 6) {
    return true;
  }

  if (/[A-Z]{7,}/.test(cleaned) && !hasVowel) {
    return true;
  }

  return false;
};

const hasPrice = (asset: TokenAsset): boolean => {
  if (typeof asset.priceUsd === "number") {
    return Number.isFinite(asset.priceUsd) && asset.priceUsd > 0;
  }
  return Number.isFinite(asset.usdValue) && asset.usdValue > 0;
};

export function filterAssets(
  assets: TokenAsset[],
  options: AssetFilterOptions = {},
): AssetFilterResult {
  const liquidityThresholdUsd = options.liquidityThresholdUsd ?? 0;
  const verified: TokenAsset[] = [];
  const hidden: TokenAsset[] = [];

  assets.forEach((asset) => {
    if (isSolToken(asset)) {
      verified.push(asset);
      return;
    }

    if (!hasPrice(asset)) {
      hidden.push(asset);
      return;
    }

    if (
      typeof asset.liquidityUsd === "number" &&
      asset.liquidityUsd < liquidityThresholdUsd
    ) {
      hidden.push(asset);
      return;
    }

    if (isSuspiciousSymbol(asset.symbol)) {
      hidden.push(asset);
      return;
    }

    verified.push(asset);
  });

  return { verified, hidden };
}
