import {
  SolanaMobileWalletAdapterError,
  SolanaMobileWalletAdapterErrorCode,
} from "@solana-mobile/mobile-wallet-adapter-protocol";

/**
 * Handle Solana mobile wallet adapter errors
 * @param error Error object
 * @returns Formatted error message
 */
export const handleWalletError = (error: unknown): string => {
  if (error instanceof SolanaMobileWalletAdapterError) {
    switch (error.code) {
      case SolanaMobileWalletAdapterErrorCode.ERROR_SECURE_CONTEXT_REQUIRED:
        console.error("MWA requires HTTPS");
        return "MWA requires HTTPS";
      case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_TIMEOUT:
        console.error("Wallet connection timed out");
        return "Wallet connection timed out";
      case SolanaMobileWalletAdapterErrorCode.ERROR_SESSION_CLOSED:
        console.error("Wallet session closed unexpectedly");
        return "Wallet session closed unexpectedly";
      case SolanaMobileWalletAdapterErrorCode.ERROR_WALLET_NOT_FOUND:
        console.error("No compatible wallet found");
        return "No compatible wallet found";
      default:
        console.error("Wallet adapter error:", error.message);
        return error.message;
    }
  } else if (error instanceof Error) {
    console.error("Wallet error:", error.message);
    return error.message;
  } else {
    console.error("Unknown wallet error:", error);
    return "Unknown wallet error";
  }
};

/**
 * Handle general API errors
 * @param error Error object
 * @param defaultMessage Default error message
 * @returns Formatted error message
 */
export const handleApiError = (error: unknown, defaultMessage: string = "API error"): string => {
  if (error instanceof Error) {
    console.error(`${defaultMessage}:`, error.message);
    return error.message;
  } else {
    console.error(`${defaultMessage}:`, error);
    return defaultMessage;
  }
};

/**
 * Handle secure storage errors
 * @param error Error object
 * @returns Formatted error message
 */
export const handleStorageError = (error: unknown): string => {
  if (error instanceof Error) {
    console.warn("Storage error:", error.message);
    return error.message;
  } else {
    console.warn("Storage error:", error);
    return "Storage error";
  }
};
