// Expo inlines EXPO_PUBLIC_* values at build time; Node polyfills are not available on device.
declare const process: { env?: Record<string, string | undefined> };

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

export const API_URL = getEnv("EXPO_PUBLIC_API_URL", "http://localhost:3000");
export const HELIUS_API_KEY = getEnv("EXPO_PUBLIC_HELIUS_API_KEY", "demo");
export const HELIUS_API_BASE = getEnv(
  "EXPO_PUBLIC_HELIUS_API_BASE",
  "https://api.helius.xyz",
);
export const COINGECKO_API_KEY = getEnv("EXPO_PUBLIC_COINGECKO_API_KEY", "");
export const JUPITER_API_KEY = process.env?.EXPO_PUBLIC_JUPITER_API_KEY || "";
export const SOLANA_CLUSTER = "solana:mainnet-beta";
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
