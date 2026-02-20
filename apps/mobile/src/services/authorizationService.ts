import * as Crypto from "expo-crypto";
import type {
  RecordSilentReauthorizationPayload,
  RecordTransactionAuditPayload,
  SessionKey,
  SessionKeySettings,
  SilentReauthorizationRecord,
  TransactionAuditEntry,
} from "@wallethub/contracts";
import { API_URL } from "../config/env";
import { useWalletStore } from "../navigation/walletStore";
import { walletService } from "./walletService";
import { Buffer } from "buffer";
import { LinkedWallet } from "../types/wallet";

const BASE_URL = API_URL.replace(/\/$/, "");
const SIGNABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

  const response = await fetch(`${BASE_URL}${path}`, {
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

const get = <T>(path: string) => request<T>(path);

const post = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

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

export const authorizationApi = {
  fetchSessionKeys: () => get<SessionKey[]>("/session"),
  fetchSessionSettings: () => get<SessionKeySettings>("/session/status"),
  fetchSilentReauthorizations: () =>
    get<SilentReauthorizationRecord[]>("/session/silent"),
  recordSilentReauthorization: (payload: RecordSilentReauthorizationPayload) =>
    post<SilentReauthorizationRecord>("/session/silent", payload),
  fetchTransactionAudits: () => get<TransactionAuditEntry[]>("/session/audits"),
  recordTransactionAudit: (payload: RecordTransactionAuditPayload) =>
    post<TransactionAuditEntry>("/session/audits", payload),
};
