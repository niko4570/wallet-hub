export type PortfolioAllocationEntry = {
  symbol: string;
  usdValue: number;
  percentage: number;
};

export type PortfolioAllocationResult = {
  totalUsd: number;
  allocation: PortfolioAllocationEntry[];
};

export type PortfolioAllocationInput = {
  symbol: string;
  usdValue: number;
};

export function buildPortfolioAllocation(
  assets: PortfolioAllocationInput[],
  minUsdValue: number,
): PortfolioAllocationResult {
  const minValue = Math.max(0, minUsdValue);
  const filtered = assets.filter((asset) => asset.usdValue >= minValue);
  const totalUsd = filtered.reduce((sum, asset) => sum + asset.usdValue, 0);

  if (totalUsd <= 0) {
    return { totalUsd: 0, allocation: [] };
  }

  const allocation = filtered
    .map((asset) => ({
      symbol: asset.symbol,
      usdValue: asset.usdValue,
      percentage: asset.usdValue / totalUsd,
    }))
    .sort((a, b) => b.usdValue - a.usdValue);

  return { totalUsd, allocation };
}
