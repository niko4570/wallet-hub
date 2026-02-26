import { HELIUS_API_BASE, HELIUS_API_KEY } from "../../config/env";

const heliusBaseUrl = HELIUS_API_BASE.replace(/\/$/, "");

// Track in-flight requests to avoid concurrent calls
let inFlightRequest: Promise<any> | null = null;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches transaction details from Helius API for a given transaction signature.
 * Implements rate limiting and request deduplication to prevent API abuse.
 *
 * This function:
 * - Waits for any in-flight request to complete before starting a new one
 * - Adds a 600ms delay between requests to prevent rate limiting
 * - Tracks in-flight requests to avoid concurrent calls
 * - Handles errors gracefully and clears in-flight state on failure
 *
 * @param signature - The transaction signature to fetch details for
 * @returns Promise resolving to the transaction details from Helius API
 * @throws {Error} If Helius API key is not configured or the API request fails
 *
 * @example
 * ```typescript
 * try {
 *   const txDetails = await getTransaction("5H7vX...");
 *   console.log(txDetails);
 * } catch (error) {
 *   console.error("Failed to fetch transaction:", error);
 * }
 * ```
 */
const getTransaction = async (signature: string): Promise<any> => {
  if (!HELIUS_API_KEY) {
    throw new Error("Helius API key not configured");
  }

  try {
    // Wait for any in-flight request to complete
    if (inFlightRequest) {
      console.debug("Waiting for in-flight Helius request to complete");
      await inFlightRequest;
    }

    // Add 600ms delay to prevent rate limiting
    console.debug("Adding 600ms delay to prevent Helius rate limiting");
    await delay(600);

    // Set this request as in-flight
    inFlightRequest = (async () => {
      try {
        const response = await fetch(`${heliusBaseUrl}/v0/transactions`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${HELIUS_API_KEY}`,
          },
          body: JSON.stringify({ transactions: [signature] }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Helius API error: ${response.status}`, {
            error: errorText,
          });
          throw new Error(
            `Helius API error: ${response.status} - ${errorText}`,
          );
        }

        const payload = await response.json();
        return payload;
      } finally {
        // Clear in-flight flag regardless of success or failure
        inFlightRequest = null;
      }
    })();

    return await inFlightRequest;
  } catch (error) {
    console.error(`Error in getTransaction:`, error);
    // Clear in-flight flag on error
    inFlightRequest = null;
    throw error;
  }
};

/**
 * Helius service for fetching Solana transaction data.
 * Provides a simplified interface to the Helius API with built-in
 * rate limiting and request deduplication.
 */
export const heliusService = {
  getTransaction,
  isConfigured: !!HELIUS_API_KEY,
};
