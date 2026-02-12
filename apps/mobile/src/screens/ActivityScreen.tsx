import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { formatAddress, formatSignature, formatAmount } from "../utils/format";
import { useWalletStore } from "../store/walletStore";
import { rpcService, heliusService } from "../services";
import { Transaction, AuthorizationEvent as AuthEvent } from "../types";
import { SkeletonTransaction } from "../components/common/SkeletonLoader";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const ActivityScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { linkedWallets, activeWallet } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<"transactions" | "authorizations">(
    "transactions",
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [authorizations, setAuthorizations] = useState<AuthEvent[]>([]);
  const [lastSignature, setLastSignature] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const parseHeliusTransaction = useCallback(
    (
      payload: any,
      signature: string,
      fallbackBlockTime: number | null,
      fallbackStatus: string,
      walletAddress?: string,
    ): Transaction | null => {
      try {
        // 处理 Helius API 返回的数组格式数据
        const txArray = Array.isArray(payload) ? payload : [];
        const tx = txArray[0] ?? payload?.data ?? payload;
        if (!tx) {
          return null;
        }

        const blockTime =
          typeof tx?.timestamp === "number"
            ? tx.timestamp
            : typeof tx?.blockTime === "number"
              ? tx.blockTime
              : typeof tx?.block_time === "number"
                ? tx.block_time
                : fallbackBlockTime;

        const derivedStatus =
          typeof tx?.status === "string"
            ? tx.status.toLowerCase() === "success" ||
              tx.status.toLowerCase() === "confirmed"
              ? "success"
              : tx.status.toLowerCase() === "failed"
                ? "failed"
                : "pending"
            : typeof tx?.success === "boolean"
              ? tx.success
                ? "success"
                : "failed"
              : fallbackStatus === "confirmed"
                ? "success"
                : "pending";

        const feeRaw =
          typeof tx?.fee === "number"
            ? tx.fee
            : typeof tx?.feeLamports === "number"
              ? tx.feeLamports
              : undefined;
        const fee =
          typeof feeRaw === "number"
            ? feeRaw > 1
              ? feeRaw / LAMPORTS_PER_SOL
              : feeRaw
            : undefined;

        const collectTransfers = (entries: any[] | undefined) =>
          Array.isArray(entries) ? entries : [];

        const tokenTransfers = collectTransfers(
          tx?.tokenTransfers ?? tx?.token_transfers,
        );
        const solTransfers = collectTransfers(
          tx?.nativeTransfers ?? tx?.solTransfers ?? tx?.native_transfers,
        );
        const allTransfers = [...solTransfers, ...tokenTransfers];

        const pickTransfer = (transfers: any[]) => {
          if (!walletAddress) {
            return transfers[0];
          }
          return (
            transfers.find(
              (transfer) =>
                transfer?.source === walletAddress ||
                transfer?.destination === walletAddress ||
                transfer?.fromUserAccount === walletAddress ||
                transfer?.toUserAccount === walletAddress ||
                transfer?.from === walletAddress ||
                transfer?.to === walletAddress,
            ) ?? transfers[0]
          );
        };

        const selectedTransfer = pickTransfer(allTransfers);

        const readString = (...values: Array<string | undefined>) =>
          values.find(
            (value) => typeof value === "string" && value.length > 0,
          ) || "";

        const readNumber = (value: unknown) => {
          if (typeof value === "number") return value;
          if (typeof value === "string" && value.length > 0) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : undefined;
          }
          return undefined;
        };

        const normalizeTokenAmount = (
          rawAmount: unknown,
          decimals?: number,
        ) => {
          const numericAmount = readNumber(rawAmount);
          if (typeof numericAmount !== "number") return 0;
          if (typeof decimals === "number" && Number.isInteger(numericAmount)) {
            return numericAmount / Math.pow(10, decimals);
          }
          return numericAmount;
        };

        let source = "";
        let destination = "";
        let amount = 0;
        let amountUnit = "SOL";

        if (selectedTransfer) {
          source = readString(
            selectedTransfer.source,
            selectedTransfer.fromUserAccount,
            selectedTransfer.from,
            selectedTransfer.sender,
          );
          destination = readString(
            selectedTransfer.destination,
            selectedTransfer.toUserAccount,
            selectedTransfer.to,
            selectedTransfer.receiver,
          );

          const lamports = readNumber(
            selectedTransfer.lamports ??
              selectedTransfer.lamport ??
              selectedTransfer.amount,
          );
          if (typeof lamports === "number") {
            amount = lamports / LAMPORTS_PER_SOL;
            amountUnit = "SOL";
          } else {
            const decimals = readNumber(
              selectedTransfer.decimals ??
                selectedTransfer.tokenDecimals ??
                selectedTransfer?.token?.decimals ??
                selectedTransfer?.tokenAmount?.decimals,
            );
            amount = normalizeTokenAmount(
              selectedTransfer.amount ??
                selectedTransfer.value ??
                selectedTransfer.uiAmount ??
                selectedTransfer?.tokenAmount?.amount ??
                selectedTransfer?.tokenAmount,
              typeof decimals === "number" ? decimals : undefined,
            );
            amountUnit =
              readString(
                selectedTransfer.symbol,
                selectedTransfer.tokenSymbol,
                selectedTransfer?.token?.symbol,
              ) || "TOKEN";
          }
        }

        // 尝试从多个字段获取 source 和 destination
        if (!source || !destination) {
          source = readString(
            tx?.source,
            tx?.from,
            tx?.signer,
            tx?.transaction?.message?.accountKeys?.[0],
          );
          destination = readString(
            tx?.destination,
            tx?.to,
            tx?.receiver,
            tx?.transaction?.message?.accountKeys?.[1],
          );
        }

        // 如果仍然找不到，使用一个默认值而不是返回 null
        if (!source) {
          source = "Unknown";
        }
        if (!destination) {
          destination = "Unknown";
        }

        const slot = typeof tx?.slot === "number" ? tx.slot : undefined;
        const memo = typeof tx?.memo === "string" ? tx.memo : undefined;

        return {
          id: signature,
          signature,
          source,
          destination,
          amount,
          amountUnit,
          status: derivedStatus,
          timestamp: new Date(
            blockTime ? blockTime * 1000 : Date.now(),
          ).toISOString(),
          type: "transfer",
          fee,
          slot,
          memo,
        };
      } catch (error) {
        console.warn(`Failed to parse Helius transaction ${signature}:`, error);
        return null;
      }
    },
    [],
  );

  // Calculate transaction amount and determine direction
  const parseTransaction = useCallback(
    (
      tx: any,
      signature: string,
      blockTime: number | null,
      status: string,
    ): Transaction | null => {
      try {
        if (!tx?.transaction?.message) return null;

        const { transaction, meta, slot } = tx;
        const message = transaction.message;
        const instructions = message?.instructions;

        if (!Array.isArray(instructions) || instructions.length === 0) {
          return null;
        }

        const parsedInstruction = instructions.find((instruction: any) => {
          const parsed = instruction?.parsed;
          if (!parsed?.info) {
            return false;
          }
          const program = instruction?.program;
          const type = parsed?.type;
          if (program === "system" && type === "transfer") {
            return true;
          }
          if (
            program === "spl-token" &&
            (type === "transfer" || type === "transferChecked")
          ) {
            return true;
          }
          return false;
        });

        if (!parsedInstruction?.parsed?.info) {
          return null;
        }

        const info = parsedInstruction.parsed.info;
        const program = parsedInstruction.program;
        const source =
          info.source || info.authority || info.owner || info.from || "";
        const destination =
          info.destination ||
          info.newAccount ||
          info.recipient ||
          info.to ||
          "";

        if (!source || !destination) {
          return null;
        }

        let amount = 0;
        let amountUnit = "SOL";

        if (program === "system") {
          const lamports = Number(info.lamports ?? info.amount ?? 0);
          amount = lamports / LAMPORTS_PER_SOL;
        } else if (program === "spl-token") {
          const uiAmount = info.tokenAmount?.uiAmount;
          const uiAmountString = info.tokenAmount?.uiAmountString;
          amount =
            typeof uiAmount === "number"
              ? uiAmount
              : Number(uiAmountString ?? info.amount ?? 0);
          amountUnit = "TOKEN";
        }

        const derivedStatus = meta?.err
          ? "failed"
          : status === "confirmed"
            ? "success"
            : "pending";
        const fee =
          typeof meta?.fee === "number"
            ? meta.fee / LAMPORTS_PER_SOL
            : undefined;

        return {
          id: signature,
          signature,
          source,
          destination,
          amount,
          amountUnit,
          status: derivedStatus,
          timestamp: new Date(
            blockTime ? blockTime * 1000 : Date.now(),
          ).toISOString(),
          type: "transfer",
          fee,
          slot: typeof slot === "number" ? slot : undefined,
        };
      } catch (error) {
        console.warn(`Failed to parse transaction ${signature}:`, error);
        return null;
      }
    },
    [],
  );

  // Fetch transactions for active wallet
  const fetchTransactions = useCallback(
    async (isLoadMore = false, currentLastSignature?: string) => {
      if (!activeWallet) {
        setTransactions([]);
        return;
      }

      try {
        const limit = 20;
        const signatures = await rpcService.getSignaturesForAddress(
          activeWallet.address,
          limit,
          isLoadMore ? currentLastSignature : undefined,
        );

        if (signatures.length === 0) {
          if (!isLoadMore) {
            setTransactions([]);
          }
          setHasMore(false);
          return;
        }

        const transactionPromises: Array<Promise<Transaction | null>> =
          signatures.map(async (sig) => {
            try {
              const heliusPayload = await heliusService.getTransaction(
                sig.signature,
              );
              const parsed = parseHeliusTransaction(
                heliusPayload,
                sig.signature,
                sig.blockTime,
                sig.status,
                activeWallet.address,
              );
              if (parsed) {
                return parsed;
              }
            } catch (error) {
              console.warn(`Helius fetch failed for ${sig.signature}:`, error);
            }

            try {
              const tx = await rpcService.getTransaction(sig.signature);
              return parseTransaction(
                tx,
                sig.signature,
                sig.blockTime,
                sig.status,
              );
            } catch (error) {
              console.warn(
                `Failed to fetch transaction ${sig.signature}:`,
                error,
              );
              return null;
            }
          });

        const results = await Promise.all(transactionPromises);
        const validTransactions = results.filter(
          (tx): tx is Transaction => tx !== null,
        );

        // 批量更新状态，减少重渲染
        if (isLoadMore) {
          setTransactions((prev) => [...prev, ...validTransactions]);
        } else {
          setTransactions(validTransactions);
        }

        if (validTransactions.length > 0) {
          setLastSignature(signatures[signatures.length - 1].signature);
        }

        setHasMore(signatures.length === limit);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        if (!isLoadMore) {
          setTransactions([]);
        }
      }
    },
    [activeWallet, parseHeliusTransaction, parseTransaction],
  );

  // Fetch authorizations
  const fetchAuthorizations = useCallback(async () => {
    setAuthorizations([]);
  }, []);

  // Load data when active wallet changes or tab changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === "transactions") {
          // 重置状态
          setLastSignature(undefined);
          setHasMore(true);
          await fetchTransactions(false);
        } else {
          await fetchAuthorizations();
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeWallet, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "transactions") {
        // 重置状态
        setLastSignature(undefined);
        setHasMore(true);
        await fetchTransactions(false);
      } else {
        await fetchAuthorizations();
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore && activeTab === "transactions") {
      setLoadingMore(true);
      try {
        await fetchTransactions(true, lastSignature);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, activeTab, lastSignature]);

  const handleTransactionDetail = (signature: string) => {
    // Open Solscan.io for transaction details
    const solscanUrl = `https://solscan.io/tx/${signature}`;
    // Use Linking API to open the URL in a browser
    Linking.openURL(solscanUrl);
  };

  const handleAuthorizationDetail = (authorizationId: string) => {
    navigation.navigate("AuthorizationDetail", { authorizationId });
  };

  const renderTransaction = ({ item }: ListRenderItemInfo<Transaction>) => {
    const isOutbound = item.source === activeWallet?.address;
    const amountUnit = item.amountUnit ?? "SOL";

    return (
      <TouchableOpacity
        style={styles.transactionCard}
        onPress={() => handleTransactionDetail(item.signature)}
      >
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionSignature}>
            {formatSignature(item.signature)}
          </Text>
          <View
            style={[
              styles.transactionStatus,
              item.status === "success"
                ? styles.transactionStatusSuccess
                : item.status === "failed"
                  ? styles.transactionStatusFailed
                  : styles.transactionStatusPending,
            ]}
          >
            <Text
              style={[
                styles.transactionStatusText,
                item.status === "success"
                  ? styles.transactionStatusTextSuccess
                  : item.status === "failed"
                    ? styles.transactionStatusTextFailed
                    : styles.transactionStatusTextPending,
              ]}
            >
              {item.status}
            </Text>
          </View>
        </View>
        <View style={styles.transactionInfo}>
          <Text
            style={[
              styles.transactionAmount,
              isOutbound && styles.transactionAmountOutbound,
            ]}
          >
            {isOutbound
              ? `- ${formatAmount(item.amount)} ${amountUnit}`
              : `+ ${formatAmount(item.amount)} ${amountUnit}`}
          </Text>
        </View>

        {/* Data field */}
        {item.memo && (
          <View style={styles.transactionMetaBlock}>
            <Text style={styles.transactionMetaLabel}>Data</Text>
            <Text style={styles.transactionMetaValue}>{item.memo}</Text>
          </View>
        )}

        {/* To Network field */}
        <View style={styles.transactionMetaBlock}>
          <Text style={styles.transactionMetaLabel}>To Network</Text>
          <Text style={styles.transactionMetaValue}>Solana</Text>
        </View>

        {/* From and To fields */}
        <View style={styles.transactionMetaBlock}>
          <Text style={styles.transactionMetaLabel}>From</Text>
          <Text style={styles.transactionMetaValue}>{item.source}</Text>
        </View>
        <View style={styles.transactionMetaBlock}>
          <Text style={styles.transactionMetaLabel}>To</Text>
          <Text style={styles.transactionMetaValue}>{item.destination}</Text>
        </View>

        {/* Network Fee field */}
        {typeof item.fee === "number" && (
          <View style={styles.transactionMetaBlock}>
            <Text style={styles.transactionMetaLabel}>Network Fee</Text>
            <Text style={styles.transactionMetaValue}>
              {formatAmount(item.fee)} SOL
            </Text>
          </View>
        )}

        {/* Slot field */}
        {typeof item.slot === "number" && (
          <View style={styles.transactionMetaBlock}>
            <Text style={styles.transactionMetaLabel}>Slot</Text>
            <Text style={styles.transactionMetaValue}>{item.slot}</Text>
          </View>
        )}

        <Text style={styles.transactionTimestamp}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#7F56D9" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.listContent}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonTransaction key={index} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "transactions" && styles.activeTab]}
          onPress={() => setActiveTab("transactions")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "transactions" && styles.activeTabText,
            ]}
          >
            Transactions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "authorizations" && styles.activeTab,
          ]}
          onPress={() => setActiveTab("authorizations")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "authorizations" && styles.activeTabText,
            ]}
          >
            Authorizations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "transactions" ? (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7F56D9"
              colors={["#7F56D9"]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No transactions found</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.section}>
            {authorizations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No authorization events found
                </Text>
              </View>
            ) : (
              authorizations.map((authorization) => (
                <TouchableOpacity
                  key={authorization.id}
                  style={styles.authorizationCard}
                  onPress={() => handleAuthorizationDetail(authorization.id)}
                >
                  <View style={styles.authorizationHeader}>
                    <Text style={styles.authorizationWallet}>
                      {authorization.walletName ||
                        formatAddress(authorization.walletAddress)}
                    </Text>
                    <View
                      style={[
                        styles.authorizationStatus,
                        authorization.status === "fresh"
                          ? styles.authorizationStatusFresh
                          : styles.authorizationStatusStale,
                      ]}
                    >
                      <Text
                        style={[
                          styles.authorizationStatusText,
                          authorization.status === "fresh"
                            ? styles.authorizationStatusTextFresh
                            : styles.authorizationStatusTextStale,
                        ]}
                      >
                        {authorization.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.authorizationInfo}>
                    <Text style={styles.authorizationMethod}>
                      Method: {authorization.method}
                    </Text>
                    <Text style={styles.authorizationAddress}>
                      {formatAddress(authorization.walletAddress)}
                    </Text>
                  </View>
                  <Text style={styles.authorizationTimestamp}>
                    {new Date(authorization.timestamp).toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1221",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1221",
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#7F56D9",
  },
  tabText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#7F56D9",
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 24,
  },
  section: {
    padding: 24,
  },
  emptyState: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    marginTop: 24,
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
  },
  transactionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  transactionSignature: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  transactionStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  transactionStatusSuccess: {
    backgroundColor: "rgba(0, 255, 179, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 179, 0.4)",
  },
  transactionStatusPending: {
    backgroundColor: "rgba(255, 204, 0, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 204, 0, 0.4)",
  },
  transactionStatusFailed: {
    backgroundColor: "rgba(255, 77, 77, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  transactionStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  transactionStatusTextSuccess: {
    color: "#00FFB3",
  },
  transactionStatusTextPending: {
    color: "#FFCC00",
  },
  transactionStatusTextFailed: {
    color: "#FF4D4D",
  },
  transactionInfo: {
    marginBottom: 8,
  },
  transactionAmount: {
    color: "#00FFB3",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  transactionAmountOutbound: {
    color: "#FF4D4D",
  },
  transactionMetaBlock: {
    marginBottom: 8,
  },
  transactionMetaLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginBottom: 4,
  },
  transactionMetaValue: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
  },
  transactionMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  transactionMetaInline: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  transactionTimestamp: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
  },
  authorizationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  authorizationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  authorizationWallet: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  authorizationStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  authorizationStatusFresh: {
    backgroundColor: "rgba(127, 86, 217, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(127, 86, 217, 0.4)",
  },
  authorizationStatusStale: {
    backgroundColor: "rgba(255, 77, 77, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.4)",
  },
  authorizationStatusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  authorizationStatusTextFresh: {
    color: "#7F56D9",
  },
  authorizationStatusTextStale: {
    color: "#FF4D4D",
  },
  authorizationInfo: {
    marginBottom: 8,
  },
  authorizationMethod: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    marginBottom: 4,
  },
  authorizationAddress: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  authorizationTimestamp: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 11,
  },
});

export default ActivityScreen;
