// Portfolio performance calculation utilities for Solana wallet analysis

/**
 * Calculates the percentage change in portfolio value over a specified time range
 * @param currentTotalUSD - Current total portfolio value in USD
 * @param historicalSnapshots - Array of historical portfolio snapshots
 * @param range - Time range to calculate change over (1D, 7D, or 30D)
 * @returns Percentage change rounded to 2 decimal places
 */
export function calculatePortfolioChangePercent(
  currentTotalUSD: number,
  historicalSnapshots: { timestamp: number; totalValueUSD: number }[],
  range: "1D" | "7D" | "30D",
): number {
  // Validate inputs
  if (isNaN(currentTotalUSD) || currentTotalUSD < 0) {
    return 0;
  }

  if (!Array.isArray(historicalSnapshots) || historicalSnapshots.length === 0) {
    return 0;
  }

  // Calculate target timestamp based on range
  const now = Date.now();
  let targetTimestamp: number;

  switch (range) {
    case "1D":
      targetTimestamp = now - 24 * 60 * 60 * 1000; // 24 hours
      break;
    case "7D":
      targetTimestamp = now - 7 * 24 * 60 * 60 * 1000; // 7 days
      break;
    case "30D":
      targetTimestamp = now - 30 * 24 * 60 * 60 * 1000; // 30 days
      break;
    default:
      return 0;
  }

  // Find the historical snapshot closest to the target timestamp
  let closestSnapshot = historicalSnapshots[0];
  let minTimeDifference = Math.abs(closestSnapshot.timestamp - targetTimestamp);

  for (const snapshot of historicalSnapshots) {
    const timeDifference = Math.abs(snapshot.timestamp - targetTimestamp);
    if (
      timeDifference < minTimeDifference ||
      (timeDifference === minTimeDifference &&
        snapshot.timestamp > closestSnapshot.timestamp)
    ) {
      minTimeDifference = timeDifference;
      closestSnapshot = snapshot;
    }
  }

  const previousTotalValue = closestSnapshot.totalValueUSD;

  // Handle edge cases
  if (isNaN(previousTotalValue) || previousTotalValue <= 0) {
    return 0;
  }

  // Calculate percentage change
  const changePercent =
    ((currentTotalUSD - previousTotalValue) / previousTotalValue) * 100;

  // Handle NaN or Infinity results
  if (isNaN(changePercent) || !isFinite(changePercent)) {
    return 0;
  }

  // Round to exactly 2 decimal places
  return Math.round(changePercent * 100) / 100;
}

/**
 * Filters historical data by time range
 * @param historicalData - Array of historical portfolio snapshots
 * @param days - Number of days to include
 * @returns Filtered historical data
 */
export function filterHistoricalDataByRange(
  historicalData: Array<
    | { timestamp: number; totalValueUSD: number }
    | { timestamp: number; usd: number; sol: number }
  >,
  days: number,
): { timestamp: number; totalValueUSD: number }[] {
  if (!Array.isArray(historicalData)) {
    return [];
  }

  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
  return historicalData
    .filter((item) => item.timestamp >= cutoffTime)
    .map((item) => ({
      timestamp: item.timestamp,
      totalValueUSD: "totalValueUSD" in item ? item.totalValueUSD : item.usd,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}
