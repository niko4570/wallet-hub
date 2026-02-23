// Dashboard related types for crypto wallet dashboard

/**
 * Token information for dashboard display
 */
export interface DashboardToken {
  /** Token symbol (e.g., SOL, USDC) */
  symbol: string;
  /** Token mint address */
  mint: string;
  /** Token balance */
  balance: number;
  /** Token price in USD */
  priceUSD: number;
  /** Token value in USD */
  valueUSD: number;
  /** 24-hour price change percentage */
  percentChange24h: number;
}

/**
 * Historical total value data point
 */
export interface HistoricalValuePoint {
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Total portfolio value in USD at this timestamp */
  totalValueUSD: number;
}

/**
 * Portfolio summary for dashboard display
 */
export interface PortfolioSummary {
  /** Total portfolio value in USD */
  totalValueUSD: number;
  /** 24-hour change percentage */
  percentChange24h: number;
  /** List of tokens in the portfolio */
  tokens: DashboardToken[];
  /** Historical total value data */
  historicalValues: HistoricalValuePoint[];
}

/**
 * Dashboard state interface
 */
export interface DashboardState {
  /** Portfolio summary data */
  portfolio: PortfolioSummary | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Time range options for historical data
 */
export type TimeRange = '24h' | '7d' | '30d';

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
  /** Time range for historical data */
  timeRange: TimeRange;
  /** Whether to include all wallets or just the active one */
  includeAllWallets: boolean;
  /** Selected wallet addresses (if includeAllWallets is false) */
  selectedWallets: string[];
}
