import type {
  RecordSilentReauthorizationPayload,
  RecordTransactionAuditPayload,
  SessionKey,
  SessionKeySettings,
  SilentReauthorizationRecord,
  TransactionAuditEntry,
} from "@wallethub/contracts";
import { API_URL } from "../config/env";

const BASE_URL = API_URL.replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
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

export const authorizationApi = {
  fetchSessionKeys: () => get<SessionKey[]>("/session"),
  fetchSessionSettings: () => get<SessionKeySettings>("/session/status"),
  fetchSilentReauthorizations: () =>
    get<SilentReauthorizationRecord[]>("/session/silent"),
  recordSilentReauthorization: (payload: RecordSilentReauthorizationPayload) =>
    post<SilentReauthorizationRecord>("/session/silent", payload),
  fetchTransactionAudits: () =>
    get<TransactionAuditEntry[]>("/session/audits"),
  recordTransactionAudit: (payload: RecordTransactionAuditPayload) =>
    post<TransactionAuditEntry>("/session/audits", payload),
};
