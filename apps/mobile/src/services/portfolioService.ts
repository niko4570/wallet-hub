import type {
  AggregatedPortfolio,
  WalletAccount,
  WalletProvider,
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

export const portfolioService = {
  fetchPortfolio: () => request<AggregatedPortfolio>("/wallets"),
  fetchWallet: (address: string) =>
    request<WalletAccount>(`/wallets/${address}`),
  linkWallet: (payload: {
    address: string;
    provider: WalletProvider;
    label?: string;
  }) =>
    request<WalletAccount>("/wallets/link", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
