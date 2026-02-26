import * as Crypto from "expo-crypto";
import type {
  RecordSilentReauthorizationPayload,
  RecordTransactionAuditPayload,
  SessionKey,
  SessionKeySettings,
  SilentReauthorizationRecord,
  TransactionAuditEntry,
} from "@wallethub/contracts";
import { API_URL } from "../../config/env";
import { useWalletStore } from "../../store/walletStore";
import { walletService } from "../wallet/walletService";
import { Buffer } from "buffer";
import { LinkedWallet } from "../../types/wallet";
import { networkSecurityService } from "../security";

const BASE_URL = API_URL.replace(/\/$/, "");
const SIGNABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Makes an authenticated HTTP request to the backend API.
 * Automatically adds wallet signature headers for write operations (POST, PUT, PATCH, DELETE).
 *
 * @template T - The expected response type
 * @param path - The API endpoint path (e.g., "/session")
 * @param init - Optional request configuration (method, headers, body)
 * @returns Promise resolving to the parsed JSON response
 * @throws {Error} If the request fails or returns a non-OK status
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const bodyString =
    typeof init?.body === "string"
      ? init.body
      : init?.body
        ? String(init.body)
        : undefined;
  const signatureHeaders =
    SIGNABLE_METHODS.has(method) && method !== "OPTIONS"
      ? await buildSignatureHeaders(method, path, bodyString)
      : {};

  const url = `${BASE_URL}${path}`;
  const validation = networkSecurityService.validateUrl(url);
  if (!validation.valid) {
    throw new Error(`Security validation failed: ${validation.error}`);
  }

  const response = await networkSecurityService.secureFetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...signatureHeaders,
    },
    ...init,
    method,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Makes a GET request to the API.
 *
 * @template T - The expected response type
 * @param path - The API endpoint path
 * @returns Promise resolving to the parsed JSON response
 */
const get = <T>(path: string) => request<T>(path);

/**
 * Makes a POST request to the API with JSON body.
 *
 * @template T - The expected response type
 * @param path - The API endpoint path
 * @param body - The request body to send as JSON
 * @returns Promise resolving to the parsed JSON response
 */
const post = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

/**
 * Builds cryptographic signature headers for authenticated API requests.
 * This implements a secure request signing mechanism using wallet signatures.
 *
 * The signing process:
 * 1. Selects the appropriate wallet (primary, active, or first linked)
 * 2. Generates a random 24-byte nonce
 * 3. Computes SHA-256 hash of the request body
 * 4. Creates a canonical message: "WalletHub|METHOD|PATH|NONCE|BODY_HASH"
 * 5. Signs the canonical message with the wallet's private key
 * 6. Returns headers with signature, nonce, and wallet address
 *
 * @param method - The HTTP method (e.g., "POST", "GET")
 * @param path - The API endpoint path
 * @param body - The request body as string (optional)
 * @returns Promise resolving to an object containing signature headers
 * @throws {Error} If no linked wallet is available
 *
 * @example
 * ```typescript
 * const headers = await buildSignatureHeaders("POST", "/session/silent", '{"data":"value"}');
 * // Returns: {
 * //   "x-wallet-address": "...",
 * //   "x-wallet-nonce": "...",
 * //   "x-wallet-body-hash": "...",
 * //   "x-wallet-signature": "...",
 * //   "x-wallet-signature-version": "1"
 * // }
 * ```
 */
async function buildSignatureHeaders(
  method: string,
  path: string,
  body?: string,
): Promise<Record<string, string>> {
  const upperMethod = method.toUpperCase();
  if (!SIGNABLE_METHODS.has(upperMethod) || upperMethod === "OPTIONS") {
    return {};
  }

  const walletStore = useWalletStore.getState();
  const candidateAddress =
    walletStore.primaryWalletAddress ??
    walletStore.activeWalletAddress ??
    walletStore.linkedWallets[0]?.address;

  if (!candidateAddress) {
    throw new Error("A linked wallet is required to complete this action.");
  }

  const walletEntry = walletStore.linkedWallets.find(
    (wallet: LinkedWallet) => wallet.address === candidateAddress,
  );

  if (!walletEntry) {
    throw new Error("Unable to locate wallet credentials for secure request.");
  }

  const nonceBytes = await Crypto.getRandomBytesAsync(24);
  const nonce = Buffer.from(nonceBytes).toString("base64");
  const normalizedBody = body ?? "";
  const bodyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizedBody,
  );
  const canonicalMessage = `WalletHub|${upperMethod}|${path}|${nonce}|${bodyHash}`;
  const signatureBytes = await walletService.signMessage(
    walletEntry,
    Buffer.from(canonicalMessage, "utf8"),
  );
  const signature = Buffer.from(signatureBytes).toString("base64");

  return {
    "x-wallet-address": walletEntry.address,
    "x-wallet-nonce": nonce,
    "x-wallet-body-hash": bodyHash,
    "x-wallet-signature": signature,
    "x-wallet-signature-version": "1",
  };
}

/**
 * Authorization API service for managing session keys and transaction audits.
 * All requests are automatically signed with the connected wallet's signature.
 */
export const authorizationApi = {
  /**
   * Fetches all session keys for the current wallet.
   * Session keys allow backend services to perform authorized actions on behalf of the wallet.
   *
   * @returns Promise resolving to an array of session keys
   */
  fetchSessionKeys: () => get<SessionKey[]>("/session"),

  /**
   * Fetches the current session status and settings.
   *
   * @returns Promise resolving to session key settings
   */
  fetchSessionSettings: () => get<SessionKeySettings>("/session/status"),

  /**
   * Fetches all silent reauthorization records.
   * Silent reauthorization allows the backend to refresh session keys without user interaction.
   *
   * @returns Promise resolving to an array of silent reauthorization records
   */
  fetchSilentReauthorizations: () =>
    get<SilentReauthorizationRecord[]>("/session/silent"),

  /**
   * Records a new silent reauthorization event.
   *
   * @param payload - The silent reauthorization payload to record
   * @returns Promise resolving to the created silent reauthorization record
   */
  recordSilentReauthorization: (payload: RecordSilentReauthorizationPayload) =>
    post<SilentReauthorizationRecord>("/session/silent", payload),

  /**
   * Fetches all transaction audit entries.
   * Transaction audits track all signed transactions for security and compliance.
   *
   * @returns Promise resolving to an array of transaction audit entries
   */
  fetchTransactionAudits: () => get<TransactionAuditEntry[]>("/session/audits"),

  /**
   * Records a new transaction audit entry.
   *
   * @param payload - The transaction audit payload to record
   * @returns Promise resolving to the created transaction audit entry
   */
  recordTransactionAudit: (payload: RecordTransactionAuditPayload) =>
    post<TransactionAuditEntry>("/session/audits", payload),
};
