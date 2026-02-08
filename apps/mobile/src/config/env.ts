import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];
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
export const SOLANA_CLUSTER = "solana:mainnet-beta";
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
