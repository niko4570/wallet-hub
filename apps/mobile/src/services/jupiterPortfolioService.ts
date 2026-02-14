import { jupiterService } from "./jupiterService";

const PORTFOLIO_ENDPOINT = "/portfolio/v1/wallet";

export interface JupiterPortfolioToken {
  address?: string;
  mint?: string;
  symbol?: string;
  name?: string;
  amount?: number;
  quantity?: number;
  balance?: number;
  decimals?: number;
  price?: number;
  priceUsd?: number;
  pricePerToken?: number;
  usdValue?: number;
  valueUsd?: number;
  value?: number;
  icon?: string;
  logoURI?: string;
}

export interface JupiterPortfolioSnapshot {
  totalValueUsd: number;
  tokens: Array<{
    mint: string;
    symbol?: string;
    name?: string;
    balance: number;
    decimals: number;
    usdValue: number;
    pricePerToken?: number;
    logoURI?: string;
  }>;
}

const extractTokensArray = (payload: any): JupiterPortfolioToken[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload.tokens)) {
    return payload.tokens;
  }
  if (Array.isArray(payload.wallet?.tokens)) {
    return payload.wallet.tokens;
  }
  if (Array.isArray(payload.data?.tokens)) {
    return payload.data.tokens;
  }
  if (Array.isArray(payload?.data?.wallet?.tokens)) {
    return payload.data.wallet.tokens;
  }
  return [];
};

const extractTotalValue = (payload: any): number => {
  const candidates = [
    payload?.totalValue,
    payload?.totalValueUsd,
    payload?.wallet?.totalValue,
    payload?.wallet?.totalValueUsd,
    payload?.data?.totalValue,
    payload?.data?.totalValueUsd,
    payload?.data?.wallet?.totalValueUsd,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return 0;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeMint = (token: JupiterPortfolioToken): string | null => {
  return (
    token.address ||
    token.mint ||
    (token as any)?.tokenAddress ||
    (token as any)?.id ||
    null
  );
};

const normalizeToken = (
  token: JupiterPortfolioToken,
): JupiterPortfolioSnapshot["tokens"][number] | null => {
  const mint = normalizeMint(token);
  if (!mint) {
    return null;
  }

  const decimals =
    coerceNumber(token.decimals) ??
    coerceNumber((token as any)?.tokenDecimals) ??
    0;
  const balance =
    coerceNumber(token.amount) ??
    coerceNumber(token.quantity) ??
    coerceNumber(token.balance) ??
    coerceNumber((token as any)?.tokenAmount?.uiAmount) ??
    0;
  const usdValue =
    coerceNumber(token.usdValue) ??
    coerceNumber(token.valueUsd) ??
    coerceNumber(token.value) ??
    coerceNumber((token as any)?.tokenValue) ??
    0;
  const pricePerToken =
    coerceNumber(token.pricePerToken) ??
    coerceNumber(token.priceUsd) ??
    coerceNumber(token.price) ??
    (balance && usdValue ? usdValue / balance : undefined);

  return {
    mint,
    symbol: token.symbol,
    name: token.name,
    balance: balance ?? 0,
    decimals,
    usdValue: usdValue ?? 0,
    pricePerToken,
    logoURI: token.logoURI ?? token.icon,
  };
};

export async function fetchJupiterPortfolioSnapshot(
  address: string,
): Promise<JupiterPortfolioSnapshot | null> {
  if (!address) {
    return null;
  }

  try {
    const payload = await jupiterService.requestJson(
      `${PORTFOLIO_ENDPOINT}/${address}`,
      {
        cacheKey: `jupiter-portfolio:${address}`,
        cacheTtlMs: 60 * 1000,
      },
    );
    const tokens = extractTokensArray(payload)
      .map(normalizeToken)
      .filter(Boolean) as JupiterPortfolioSnapshot["tokens"];

    if (tokens.length === 0) {
      return null;
    }

    const totalValueUsd =
      extractTotalValue(payload) ||
      tokens.reduce((sum, token) => sum + (token.usdValue ?? 0), 0);

    return {
      totalValueUsd,
      tokens,
    };
  } catch (error) {
    console.warn("Failed to fetch Jupiter portfolio snapshot", error);
    return null;
  }
}

export const jupiterPortfolioService = {
  fetchSnapshot: fetchJupiterPortfolioSnapshot,
};
