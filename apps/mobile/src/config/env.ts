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

const deriveHostFromUrl = (url: string): string => {
  try {
    return new URL(url).host;
  } catch (_error) {
    return "";
  }
};

const defaultJupiterPluginUrl = getEnv(
  "EXPO_PUBLIC_JUPITER_PLUGIN_URL",
  "https://plugin.jup.ag/?displayMode=integrated&theme=dark&bgColor=050814&primaryColor=9B8CFF",
);

const defaultJupiterPluginHost =
  deriveHostFromUrl(defaultJupiterPluginUrl) || "plugin.jup.ag";

const jupiterPluginAllowlistRaw = getEnv(
  "EXPO_PUBLIC_JUPITER_PLUGIN_ALLOWLIST",
  defaultJupiterPluginHost,
);

export const JUPITER_PLUGIN_URL = defaultJupiterPluginUrl;
export const JUPITER_PLUGIN_ALLOWED_HOSTS = jupiterPluginAllowlistRaw
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

export const TELEMETRY_ENDPOINT =
  process.env?.EXPO_PUBLIC_TELEMETRY_URL?.trim() ?? "";
