import type { PortfolioAllocationEntry } from "./allocation";

export type PortfolioCategoryName =
  | "SOL"
  | "Stablecoins"
  | "Liquid Staking"
  | "Other Tokens";

export type PortfolioCategorySlice = {
  symbol: PortfolioCategoryName;
  usdValue: number;
  percentage: number;
};

export type PortfolioConcentrationMetrics = {
  top3Percent: number;
  hhi: number;
  concentration: "Low" | "Medium" | "High";
};

const STABLECOIN_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "DAI",
  "PYUSD",
  "FDUSD",
  "USDE",
  "USDS",
  "USDH",
  "UXD",
]);

const LST_SYMBOLS = new Set([
  "MSOL",
  "STSOL",
  "JSOL",
  "BSOL",
  "INF",
  "JITOSOL",
]);

export const normalizePortfolioSymbol = (symbol?: string) =>
  (symbol ?? "").trim().toUpperCase();

export const classifyPortfolioCategory = (
  symbol: string,
): PortfolioCategoryName => {
  const normalized = normalizePortfolioSymbol(symbol);

  if (normalized === "SOL" || normalized === "WSOL") {
    return "SOL";
  }

  if (STABLECOIN_SYMBOLS.has(normalized)) {
    return "Stablecoins";
  }

  if (LST_SYMBOLS.has(normalized)) {
    return "Liquid Staking";
  }

  return "Other Tokens";
};

export const buildCategoryAllocation = (
  allocation: PortfolioAllocationEntry[],
  totalUsd: number,
): PortfolioCategorySlice[] => {
  if (allocation.length === 0 || totalUsd <= 0) {
    return [];
  }

  const grouped = new Map<PortfolioCategoryName, number>();

  allocation.forEach((entry) => {
    const category = classifyPortfolioCategory(entry.symbol);
    grouped.set(category, (grouped.get(category) ?? 0) + entry.usdValue);
  });

  return Array.from(grouped.entries())
    .map(([symbol, usdValue]) => ({
      symbol,
      usdValue,
      percentage: usdValue / totalUsd,
    }))
    .sort((a, b) => b.usdValue - a.usdValue);
};

export const buildCategoryBreakdown = (
  allocation: PortfolioAllocationEntry[],
): Map<PortfolioCategoryName, PortfolioAllocationEntry[]> => {
  const grouped = new Map<PortfolioCategoryName, PortfolioAllocationEntry[]>();

  allocation.forEach((entry) => {
    const category = classifyPortfolioCategory(entry.symbol);
    const list = grouped.get(category) ?? [];
    list.push(entry);
    grouped.set(category, list);
  });

  return grouped;
};

export const calculateConcentrationMetrics = (
  allocation: PortfolioAllocationEntry[],
): PortfolioConcentrationMetrics => {
  if (allocation.length === 0) {
    return {
      top3Percent: 0,
      hhi: 0,
      concentration: "Low",
    };
  }

  const sorted = [...allocation].sort((a, b) => b.percentage - a.percentage);
  const top3Percent = sorted
    .slice(0, 3)
    .reduce((sum, item) => sum + item.percentage * 100, 0);

  const hhi = sorted.reduce((sum, item) => {
    const sharePercent = item.percentage * 100;
    return sum + sharePercent * sharePercent;
  }, 0);

  const concentration = hhi >= 2500 ? "High" : hhi >= 1500 ? "Medium" : "Low";

  return {
    top3Percent,
    hhi,
    concentration,
  };
};
