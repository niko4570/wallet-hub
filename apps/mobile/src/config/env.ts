// Environment variables configuration
// Expo inlines EXPO_PUBLIC_* values at build time

declare const process: { env?: Record<string, string | undefined> };

/**
 * Get environment variable with fallback
 * @param key - Environment variable key
 * @param fallback - Fallback value if not found
 * @returns Environment variable value or fallback
 */
const getEnv = (key: string, fallback?: string): string => {
  const value = process.env?.[key];
  if (value && value.length > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`Missing required environment variable: ${key}`);
};

// API configuration
export const API_URL = getEnv("EXPO_PUBLIC_API_URL", "http://localhost:3000");

// Helius configuration
export const HELIUS_API_KEY = getEnv("EXPO_PUBLIC_HELIUS_API_KEY", "demo");
export const HELIUS_API_BASE = getEnv("EXPO_PUBLIC_HELIUS_API_BASE", "https://api.helius.xyz");
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Jupiter configuration
export const JUPITER_API_KEY = process.env?.EXPO_PUBLIC_JUPITER_API_KEY || "";

// CoinGecko configuration
export const COINGECKO_API_KEY = getEnv("EXPO_PUBLIC_COINGECKO_API_KEY", "");

// Solana network configuration
export const SOLANA_CLUSTER: "solana:mainnet-beta" | "solana:testnet" | "solana:devnet" = "solana:mainnet-beta";
export const SOLANA_NETWORK = "mainnet-beta";

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_BIOMETRIC: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_TOKEN_METADATA: true,
  ENABLE_WALLET_GROUPS: true,
  ENABLE_PORTFOLIO_ANALYTICS: true,
};

// App configuration
export const APP_CONFIG = {
  APP_NAME: "WalletHub",
  APP_VERSION: process.env?.EXPO_PUBLIC_APP_VERSION || "1.0.0",
  APP_URI: "https://wallethub.app",
};
