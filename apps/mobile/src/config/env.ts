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
export const COINGECKO_API_KEY = getEnv("EXPO_PUBLIC_COINGECKO_API_KEY", "");
export const SOLANA_CLUSTER = "solana:mainnet-beta";
export const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const defaultExploreUrl = getEnv(
  "EXPO_PUBLIC_EXPLORE_URL",
  "https://explore.solanamobile.com/?ref=wallethub",
);

const deriveHostFromUrl = (url: string): string => {
  try {
    return new URL(url).host;
  } catch (_error) {
    return "";
  }
};

const defaultExploreHost = deriveHostFromUrl(defaultExploreUrl) || "solana.com";

const exploreAllowlistRaw = getEnv(
  "EXPO_PUBLIC_EXPLORE_ALLOWLIST",
  defaultExploreHost,
);

export const EXTERNAL_EXPLORE_URL = defaultExploreUrl;
export const EXTERNAL_EXPLORE_ALLOWED_HOSTS = exploreAllowlistRaw
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

export const TELEMETRY_ENDPOINT =
  process.env?.EXPO_PUBLIC_TELEMETRY_URL?.trim() ?? "";
