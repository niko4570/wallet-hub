import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { API_URL, SOLANA_NETWORK } from "../../config/env";
import { rpcService } from "../solana/rpcService";
import { priceService } from "./priceService";
import { tokenMetadataService } from "./tokenMetadataService";
import { jupiterPortfolioService } from "./jupiterPortfolioService";

import { useWalletHistoricalStore } from "../../store/walletStore";
import type { WalletActivity, WalletBalance } from "../../types/wallet";
import { savePortfolioSnapshot } from "../../utils";

// Define JupiterTransactionRecord type
export interface JupiterTransactionRecord {
  signature?: string;
  txSignature?: string;
  transactionSignature?: string;
  timestamp?: number;
  blockTime?: number;
  type?: string;
  action?: string;
  description?: string;
  label?: string;
  fee?: number;
  platform?: string;
  dex?: string;
  pnlUsd?: number;
  inputMint?: string;
  inputSymbol?: string;
  outputMint?: string;
  outputSymbol?: string;
  data?: {
    inputSymbol?: string;
    outputSymbol?: string;
  };
}

const NATIVE_SOL_MINTS = new Set([
  "So11111111111111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
]);

const MAX_ACTIVITY_ENTRIES = 50;

const isNativeSolToken = (mint: string, symbol?: string) => {
  if (symbol === "SOL") {
    return true;
  }
  return NATIVE_SOL_MINTS.has(mint);
};

interface ServerSnapshotResponse {
  snapshot?: WalletBalance | null;
  activity?: WalletActivity[];
}

export interface AccountSnapshotResult {
  snapshot: WalletBalance;
  activity: WalletActivity[];
}

export async function fetchAccountSnapshot(
  address: string,
): Promise<AccountSnapshotResult> {
  const normalizedAddress = new PublicKey(address).toBase58();
  const [jupiterResult, serverResult, localResult, serverTxResult] =
    await Promise.allSettled([
      fetchJupiterSnapshot(normalizedAddress),
      fetchServerSnapshot(normalizedAddress),
      fetchLocalSnapshot(normalizedAddress),
      fetchServerTransactions(normalizedAddress),
    ]);

  let snapshot: WalletBalance | null = null;
  const serverSnapshot =
    serverResult.status === "fulfilled" ? serverResult.value : null;
  const heliusActivity = normalizeServerActivity(
    normalizedAddress,
    serverSnapshot?.activity,
  );
  const serverTransactionActivities =
    serverTxResult.status === "fulfilled"
      ? normalizeJupiterActivities(serverTxResult.value)
      : [];

  const jupiterActivity = serverTransactionActivities;
  let activity = mergeActivityTimelines(heliusActivity, jupiterActivity);

  if (jupiterResult.status === "fulfilled" && jupiterResult.value) {
    snapshot = jupiterResult.value;
  }

  if (!snapshot && serverSnapshot?.snapshot) {
    snapshot = serverSnapshot.snapshot ?? null;
  }

  if (
    snapshot &&
    (!snapshot.tokens || snapshot.tokens.length === 0) &&
    serverSnapshot?.snapshot?.tokens &&
    serverSnapshot.snapshot.tokens.length > 0
  ) {
    snapshot = {
      ...snapshot,
      tokens: serverSnapshot.snapshot.tokens,
    };
  }

  if (!snapshot && localResult.status === "fulfilled") {
    snapshot = localResult.value;
  } else if (
    snapshot &&
    localResult.status === "fulfilled" &&
    (!snapshot.tokens || snapshot.tokens.length === 0)
  ) {
    snapshot = {
      ...snapshot,
      tokens: localResult.value.tokens,
    };
  }

  if (!snapshot) {
    throw new Error("无法获取账户快照，请稍后再试。");
  }

  // Update historical balance data
  const walletHistoricalStore = useWalletHistoricalStore.getState();
  const historyUpdate = {
    timestamp: Date.now(),
    usd: Number(snapshot.usdValue.toFixed(2)),
    sol: Number(snapshot.balance.toFixed(6)),
  };

  walletHistoricalStore.updateHistoricalBalance(
    SOLANA_NETWORK,
    normalizedAddress,
    historyUpdate,
  );
  console.debug("Historical balance updated:", {
    address: normalizedAddress,
    data: historyUpdate,
  });

  // Save portfolio snapshot for performance tracking
  await savePortfolioSnapshot(snapshot.usdValue);

  return { snapshot, activity };
}

async function fetchServerSnapshot(
  address: string,
): Promise<ServerSnapshotResponse> {
  const response = await fetch(
    `${API_URL}/helius/accounts/${address}/snapshot`,
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Helius snapshot API error: ${response.status} ${errorText}`,
    );
  }
  return response.json();
}

async function fetchServerTransactions(
  address: string,
): Promise<JupiterTransactionRecord[]> {
  const response = await fetch(`${API_URL}/wallets/${address}/transactions`);
  if (!response.ok) {
    throw new Error(
      `Wallet transactions API error: ${response.status} ${await response
        .text()
        .catch(() => "")}`,
    );
  }
  return response.json();
}

async function fetchLocalSnapshot(address: string): Promise<WalletBalance> {
  const balanceLamports = await rpcService.getBalance(address);
  const solBalance = balanceLamports / LAMPORTS_PER_SOL;

  const now = new Date().toISOString();

  const [solPrice, tokenAccounts] = await Promise.all([
    priceService.getSolPriceInUsd().catch(() => 0),
    rpcService.getParsedTokenAccountsByOwner(new PublicKey(address)),
  ]);

  const tokensWithBalance = tokenAccounts.filter((token) => token.uiAmount > 0);

  const fallbackBalances =
    tokensWithBalance.length === 0
      ? await tokenMetadataService.getTokenBalancesForWallet(address)
      : [];

  const tokenMints =
    tokensWithBalance.length > 0
      ? tokensWithBalance.map((token) => token.mint)
      : fallbackBalances
          .filter((token) => !isNativeSolToken(token.mint, token.symbol))
          .map((token) => token.mint);

  const [mintPrices, metadataMap] = await Promise.all([
    tokenMints.length > 0
      ? priceService.getTokenPricesInUsd(tokenMints)
      : Promise.resolve<Record<string, number>>({}),
    tokenMints.length > 0
      ? tokenMetadataService.getMetadataMapForWallet(address, tokenMints)
      : Promise.resolve<Record<string, { symbol?: string; name?: string }>>({}),
  ]);

  const tokens =
    tokensWithBalance.length > 0
      ? tokensWithBalance.map((token) => {
          const price = mintPrices[token.mint] ?? 0;
          return {
            mint: token.mint,
            symbol: metadataMap[token.mint]?.symbol,
            name: metadataMap[token.mint]?.name,
            balance: token.uiAmount,
            usdValue: price > 0 ? token.uiAmount * price : 0,
            decimals: token.decimals,
          };
        })
      : fallbackBalances
          .filter((token) => !isNativeSolToken(token.mint, token.symbol))
          .map((token) => {
            const price = mintPrices[token.mint] ?? token.pricePerToken ?? 0;
            const usdValue =
              price > 0 ? token.balance * price : (token.usdValue ?? 0);
            return {
              mint: token.mint,
              symbol: token.symbol ?? metadataMap[token.mint]?.symbol,
              name: token.name ?? metadataMap[token.mint]?.name,
              balance: token.balance,
              usdValue,
              decimals: token.decimals,
            };
          });

  const tokenUsdValue = tokens.reduce((sum, token) => sum + token.usdValue, 0);
  const usdValue = solBalance * solPrice + tokenUsdValue;

  return {
    address,
    balance: solBalance,
    usdValue: Number(usdValue.toFixed(2)),
    lastUpdated: now,
    tokens,
    totalTokens: tokens.length,
    totalValue: Number(usdValue.toFixed(2)),
  };
}

async function fetchJupiterSnapshot(
  address: string,
): Promise<WalletBalance | null> {
  const snapshot = await jupiterPortfolioService.fetchSnapshot(address);
  if (!snapshot) {
    return null;
  }

  const now = new Date().toISOString();
  const solToken = snapshot.tokens.find((token) =>
    isNativeSolToken(token.mint, token.symbol),
  );
  const nonSolTokens = snapshot.tokens.filter(
    (token) => !isNativeSolToken(token.mint, token.symbol),
  );

  const tokens = nonSolTokens.map((token) => ({
    mint: token.mint,
    symbol: token.symbol,
    name: token.name,
    balance: token.balance,
    usdValue: Number((token.usdValue ?? 0).toFixed(4)),
    decimals: token.decimals ?? 0,
  }));

  const solBalance = solToken?.balance ?? 0;
  const totalUsdValue =
    snapshot.totalValueUsd ||
    tokens.reduce((sum, token) => sum + (token.usdValue ?? 0), 0) +
      (solToken?.usdValue ?? 0);

  return {
    address,
    balance: solBalance,
    usdValue: Number(totalUsdValue.toFixed(2)),
    lastUpdated: now,
    tokens,
    totalTokens: tokens.length,
    totalValue: Number(totalUsdValue.toFixed(2)),
  };
}

function normalizeServerActivity(
  address: string,
  entries?: any[],
): WalletActivity[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      const timestamp = toTimestampMs(entry?.timestamp);
      const signature =
        entry?.signature ??
        entry?.txSignature ??
        entry?.transactionSignature ??
        `helius-${timestamp}`;
      const changeSummary = summarizeBalanceChange(
        address,
        entry?.balanceChanges,
      );

      return {
        signature,
        timestamp,
        type: String(entry?.type ?? "unknown").toLowerCase() as any,
        description: entry?.description,
        fee:
          typeof entry?.fee === "number"
            ? Number((entry.fee / LAMPORTS_PER_SOL).toFixed(6))
            : undefined,
        source: entry?.source ?? "helius",
        amount: changeSummary?.amount,
        mint: changeSummary?.mint,
        direction: changeSummary?.direction,
        status: "success" as const,
      };
    })
    .filter((entry) => Boolean(entry.signature))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function normalizeJupiterActivities(
  entries: JupiterTransactionRecord[] = [],
): WalletActivity[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => {
      const timestamp = toTimestampMs(entry?.timestamp ?? entry?.blockTime);
      const signature =
        entry?.signature ??
        entry?.txSignature ??
        entry?.transactionSignature ??
        `jupiter-${timestamp}`;
      const type = String(
        entry?.type ?? entry?.action ?? "jupiter",
      ).toLowerCase();
      const description = buildJupiterDescription(entry);
      const direction: "in" | "out" | "internal" =
        typeof entry?.pnlUsd === "number"
          ? entry.pnlUsd >= 0
            ? "in"
            : "out"
          : "internal";

      return {
        signature,
        timestamp,
        type: type as any,
        description,
        source: entry?.platform ?? entry?.dex ?? "jupiter",
        direction,
        status: "success" as const,
      };
    })
    .filter((entry) => Boolean(entry.signature))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function summarizeBalanceChange(
  address: string,
  balanceChanges?: any[],
): {
  amount: number;
  direction: WalletActivity["direction"];
  mint?: string;
} | null {
  if (!Array.isArray(balanceChanges) || balanceChanges.length === 0) {
    return null;
  }

  const target = address.trim();
  const change = balanceChanges.find((entry) => {
    const candidates = [
      entry?.userAccount,
      entry?.owner,
      entry?.toUserAccount,
      entry?.fromUserAccount,
    ]
      .map((value: string | undefined) => value?.trim())
      .filter(Boolean);
    return candidates.includes(target);
  });

  if (!change) {
    return null;
  }

  const rawAmount = coerceNumber(
    change.amount ??
      change.delta ??
      change.changeAmount ??
      change.nativeChange ??
      change.tokenAmount,
  );

  if (rawAmount === undefined) {
    return null;
  }

  const decimals =
    typeof change.decimals === "number"
      ? change.decimals
      : typeof change.tokenDecimals === "number"
        ? change.tokenDecimals
        : change.mint && isNativeSolToken(change.mint)
          ? 9
          : 0;

  const divisor = decimals > 0 ? Math.pow(10, decimals) : 1;
  const normalizedAmount = divisor !== 0 ? rawAmount / divisor : rawAmount;

  if (!normalizedAmount) {
    return null;
  }

  const direction: WalletActivity["direction"] =
    normalizedAmount >= 0 ? "in" : "out";

  const mint =
    change.mint ??
    change.tokenMint ??
    (isNativeSolToken(change.mint ?? "") ? change.mint : undefined);

  return {
    amount: Number(Math.abs(normalizedAmount).toFixed(6)),
    direction,
    mint,
  };
}

function buildJupiterDescription(entry: JupiterTransactionRecord): string {
  const base =
    entry?.label ??
    entry?.description ??
    entry?.type ??
    entry?.action ??
    "Jupiter activity";
  const inputSymbol =
    entry?.inputSymbol ??
    entry?.data?.inputSymbol ??
    abbreviateMint(entry?.inputMint);
  const outputSymbol =
    entry?.outputSymbol ??
    entry?.data?.outputSymbol ??
    abbreviateMint(entry?.outputMint);

  if (inputSymbol && outputSymbol) {
    return `${capitalize(base)} ${inputSymbol} → ${outputSymbol}`;
  }

  return capitalize(base);
}

function abbreviateMint(mint?: string | null) {
  if (!mint || mint.length < 8) {
    return mint ?? undefined;
  }
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

function capitalize(value?: string) {
  if (!value || value.length === 0) {
    return "";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toTimestampMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Date.now();
  }
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function mergeActivityTimelines(
  ...groups: WalletActivity[][]
): WalletActivity[] {
  const flattened = groups.flat().filter(Boolean);
  if (flattened.length === 0) {
    return [];
  }

  flattened.sort((a, b) => b.timestamp - a.timestamp);
  const seen = new Set<string>();
  const result: WalletActivity[] = [];

  flattened.forEach((entry) => {
    const key = entry.signature ?? `${entry.timestamp}-${entry.type}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(entry);
  });

  return result.slice(0, MAX_ACTIVITY_ENTRIES);
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
