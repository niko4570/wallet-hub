import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
  useRef,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { formatAddress, formatAmount } from "../utils";
import { useWalletActivityStore, useWalletStore } from "../store/walletStore";
import { fetchAccountSnapshot } from "../services";
import { Transaction } from "../types";
import { SkeletonTransaction } from "../components/common/SkeletonLoader";
import { IncomeExpenseFlowChart } from "../components/analytics";
import type { MainTabParamList } from "../navigation/AppNavigator";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Search,
  X,
} from "lucide-react-native";

const CACHE_EXPIRATION = 5 * 60 * 1000;
const MAX_TOTAL_TRANSACTIONS = 100;

const ActivityScreen = () => {
  const route = useRoute<RouteProp<MainTabParamList, "Activity">>();
  const { linkedWallets } = useWalletStore();
  const { walletActivity, setWalletActivity } = useWalletActivityStore();
  const lastHandledFocusKeyRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [highlightedSignature, setHighlightedSignature] = useState<
    string | null
  >(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);

  // Transaction cache state
  const [transactionCache, setTransactionCache] = useState<
    Record<
      string,
      {
        transactions: Transaction[];
        timestamp: number;
      }
    >
  >({});

  interface TransactionItemProps {
    item: Transaction;
    linkedWallets: any[];
    onPress: (transaction: Transaction) => void;
    isHighlighted: boolean;
  }

  const TransactionItem = memo(
    ({ item, linkedWallets, onPress, isHighlighted }: TransactionItemProps) => {
      const linkedWalletAddresses = linkedWallets.map(
        (wallet: any) => wallet.address,
      );

      const isOutbound = linkedWalletAddresses.includes(item.source);
      const isInbound = linkedWalletAddresses.includes(item.destination);

      if (!isOutbound && !isInbound) {
        return null;
      }

      const amountUnit = item.amountUnit ?? "SOL";
      const counterpartyAddress = isOutbound ? item.destination : item.source;
      const formattedCounterparty = formatAddress(counterpartyAddress);

      const getTransactionInfo = () => {
        switch (item.type) {
          case "transfer":
            return {
              title: isOutbound ? "Sent SOL" : "Received SOL",
              icon: isOutbound ? (
                <ArrowUpRight size={20} color="#FF4D4D" />
              ) : (
                <ArrowDownLeft size={20} color="#00FFB3" />
              ),
              iconColor: isOutbound ? "#FF4D4D" : "#00FFB3",
            };
          case "token_transfer":
            return {
              title: isOutbound ? "Sent Token" : "Received Token",
              icon: isOutbound ? (
                <ArrowUpRight size={20} color="#FFA500" />
              ) : (
                <ArrowDownLeft size={20} color="#32CD32" />
              ),
              iconColor: isOutbound ? "#FFA500" : "#32CD32",
            };
          case "stake_delegate":
            return {
              title: "Staked SOL",
              icon: <ArrowUpRight size={20} color="#1E90FF" />,
              iconColor: "#1E90FF",
            };
          case "stake_withdraw":
            return {
              title: "Unstaked SOL",
              icon: <ArrowDownLeft size={20} color="#9370DB" />,
              iconColor: "#9370DB",
            };
          case "nft_transfer":
            return {
              title: isOutbound ? "Sent NFT" : "Received NFT",
              icon: isOutbound ? (
                <ArrowUpRight size={20} color="#FF69B4" />
              ) : (
                <ArrowDownLeft size={20} color="#FF69B4" />
              ),
              iconColor: "#FF69B4",
            };
          case "swap":
            return {
              title: "Swapped Tokens",
              icon: <ArrowUpRight size={20} color="#FFD700" />,
              iconColor: "#FFD700",
            };
          default:
            return {
              title: isOutbound ? "Sent" : "Received",
              icon: isOutbound ? (
                <ArrowUpRight size={20} color="#FF4D4D" />
              ) : (
                <ArrowDownLeft size={20} color="#00FFB3" />
              ),
              iconColor: isOutbound ? "#FF4D4D" : "#00FFB3",
            };
        }
      };

      const transactionInfo = getTransactionInfo();

      return (
        <TouchableOpacity
          style={[
            styles.transactionItem,
            isHighlighted && styles.transactionItemHighlighted,
          ]}
          onPress={() => onPress(item)}
        >
          <View
            style={[
              styles.transactionIcon,
              { backgroundColor: `${transactionInfo.iconColor}20` },
            ]}
          >
            {transactionInfo.icon}
          </View>
          <View style={styles.transactionContent}>
            <Text style={styles.transactionTitle}>{transactionInfo.title}</Text>
            <Text style={styles.transactionAddress}>
              {isOutbound
                ? `To ${formattedCounterparty}`
                : `From ${formattedCounterparty}`}
            </Text>
            <Text style={styles.transactionWallet}>
              {isOutbound
                ? `From ${formatAddress(item.source)}`
                : `To ${formatAddress(item.destination)}`}
            </Text>
          </View>
          <View style={styles.transactionAmountContainer}>
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
        </TouchableOpacity>
      );
    },
  );

  interface TransactionGroupProps {
    item: { date: string; transactions: Transaction[] };
    linkedWallets: any[];
    onTransactionPress: (transaction: Transaction) => void;
    highlightedSignature: string | null;
  }

  const TransactionGroup = memo(
    ({
      item,
      linkedWallets,
      onTransactionPress,
      highlightedSignature,
    }: TransactionGroupProps) => {
      return (
        <View style={styles.transactionGroup}>
          <Text style={styles.transactionGroupDate}>{item.date}</Text>
          {item.transactions.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              item={transaction}
              linkedWallets={linkedWallets}
              onPress={onTransactionPress}
              isHighlighted={transaction.signature === highlightedSignature}
            />
          ))}
        </View>
      );
    },
  );

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};

    transactions.forEach((transaction) => {
      const date = new Date(transaction.timestamp);
      const dateKey = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(transaction);
    });

    // Convert to array of { date, transactions } objects
    return Object.entries(groups)
      .map(([date, transactions]) => ({
        date,
        transactions,
      }))
      .sort((a, b) => {
        // Sort by date descending
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [transactions]);

  const resolveTransactionType = useCallback(
    (type?: string, description?: string): Transaction["type"] => {
      const normalizedType = (type ?? "").toLowerCase();
      const normalizedDescription = (description ?? "").toLowerCase();

      if (normalizedType === "transfer") return "transfer";
      if (normalizedType === "token_transfer") return "token_transfer";
      if (normalizedType === "nft_transfer") return "nft_transfer";
      if (normalizedType === "swap") return "swap";
      if (normalizedType === "stake") {
        return normalizedDescription.includes("withdraw") ||
          normalizedDescription.includes("unstake")
          ? "stake_withdraw"
          : "stake_delegate";
      }

      return "transfer";
    },
    [],
  );

  const mapActivityToTransaction = useCallback(
    (walletAddress: string, entry: any): Transaction => {
      const normalizedWalletAddress = walletAddress.trim();
      const direction = entry?.direction as
        | "in"
        | "out"
        | "internal"
        | undefined;

      let source = typeof entry?.source === "string" ? entry.source.trim() : "";
      let destination =
        typeof entry?.destination === "string" ? entry.destination.trim() : "";

      if (direction === "out") {
        source = normalizedWalletAddress;
        destination = destination || "Unknown";
      } else if (direction === "in") {
        source = source || "Unknown";
        destination = normalizedWalletAddress;
      } else {
        source = source || normalizedWalletAddress;
        destination = destination || normalizedWalletAddress;
      }

      const timestampValue =
        typeof entry?.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : Date.now();

      return {
        id: `${entry?.signature ?? `activity-${timestampValue}`}-${normalizedWalletAddress}`,
        signature: entry?.signature ?? `activity-${timestampValue}`,
        source,
        destination,
        amount:
          typeof entry?.amount === "number" && Number.isFinite(entry.amount)
            ? entry.amount
            : 0,
        amountUnit: entry?.mint ? "TOKEN" : "SOL",
        status:
          entry?.status === "failed"
            ? "failed"
            : entry?.status === "pending"
              ? "pending"
              : "success",
        timestamp: new Date(timestampValue).toISOString(),
        type: resolveTransactionType(entry?.type, entry?.description),
        fee: typeof entry?.fee === "number" ? entry.fee : undefined,
      };
    },
    [resolveTransactionType],
  );

  // Fetch transactions for a single wallet
  const fetchWalletTransactions = useCallback(
    async (walletAddress: string, forceRefresh = false) => {
      try {
        const cachedData = transactionCache[walletAddress];
        const now = Date.now();

        if (
          !forceRefresh &&
          cachedData &&
          now - cachedData.timestamp < CACHE_EXPIRATION
        ) {
          if (__DEV__) {
            console.log(
              `Using cached transactions for wallet: ${walletAddress}`,
            );
          }
          return cachedData.transactions;
        }

        if (__DEV__) {
          console.log(
            `Fetching aggregated wallet activity for wallet: ${walletAddress}`,
          );
        }
        const result = await fetchAccountSnapshot(walletAddress);
        const activity = Array.isArray(result.activity) ? result.activity : [];
        setWalletActivity(walletAddress, activity);
        const validTransactions = activity.map((entry) =>
          mapActivityToTransaction(walletAddress, entry),
        );

        if (__DEV__) {
          console.log(
            `Got ${validTransactions.length} valid transactions for wallet: ${walletAddress}`,
          );
        }

        // Cache the results
        setTransactionCache((prev) => ({
          ...prev,
          [walletAddress]: {
            transactions: validTransactions,
            timestamp: now,
          },
        }));

        return validTransactions;
      } catch (error) {
        console.error(
          `Failed to fetch aggregated activity for ${walletAddress}:`,
          error,
        );
        const fallbackActivity = walletActivity[walletAddress] ?? [];
        const fallbackTransactions = fallbackActivity.map((entry) =>
          mapActivityToTransaction(walletAddress, entry),
        );

        if (fallbackTransactions.length > 0) {
          return fallbackTransactions;
        }

        return [];
      }
    },
    [
      mapActivityToTransaction,
      setWalletActivity,
      transactionCache,
      walletActivity,
    ],
  );

  const fetchTransactions = useCallback(
    async (forceRefresh = false) => {
      const wallets = linkedWallets;
      if (wallets.length === 0) {
        if (__DEV__) {
          console.log("No linked wallets, setting transactions to empty");
        }
        setTransactions([]);
        return;
      }

      try {
        if (__DEV__) {
          console.log(`Fetching transactions for ${wallets.length} wallets`);
        }
        const allTransactionsPromises = wallets.map((wallet: any) =>
          fetchWalletTransactions(wallet.address, forceRefresh),
        );

        const allTransactionsResults = await Promise.all(
          allTransactionsPromises,
        );
        const allTransactions = allTransactionsResults.flat();

        if (__DEV__) {
          console.log(
            `Got ${allTransactions.length} total transactions from all wallets`,
          );
        }

        const sortedTransactions = allTransactions.sort(
          (a: Transaction, b: Transaction) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return dateB - dateA;
          },
        );

        const uniqueTransactions = sortedTransactions.filter(
          (entry, index, all) =>
            index ===
            all.findIndex(
              (item) =>
                item.signature === entry.signature &&
                item.source === entry.source &&
                item.destination === entry.destination,
            ),
        );

        const limitedTransactions = sortedTransactions.slice(
          0,
          MAX_TOTAL_TRANSACTIONS,
        );

        if (__DEV__) {
          console.log(
            `Setting ${limitedTransactions.length} sorted transactions`,
          );
        }
        setTransactions(uniqueTransactions.slice(0, MAX_TOTAL_TRANSACTIONS));
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        setTransactions([]);
      }
    },
    [linkedWallets, fetchWalletTransactions],
  );

  // Load data when linked wallets change
  useEffect(() => {
    if (__DEV__) {
      console.log(
        `useEffect triggered - linkedWallets count: ${linkedWallets.length}`,
      );
    }

    const loadData = async () => {
      setLoading(true);
      try {
        if (__DEV__) {
          console.log(
            `Calling fetchTransactions for ${linkedWallets.length} wallets`,
          );
        }
        await fetchTransactions(false);
      } finally {
        setLoading(false);
        if (__DEV__) {
          console.log(`Loading completed`);
        }
      }
    };

    loadData();
  }, [linkedWallets, fetchTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTransactions(true);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {}, []);

  const handleTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetail(true);
  };

  const renderTransactionGroup = useCallback(
    ({
      item,
    }: ListRenderItemInfo<{ date: string; transactions: Transaction[] }>) => {
      return (
        <TransactionGroup
          item={item}
          linkedWallets={linkedWallets}
          onTransactionPress={handleTransactionDetail}
          highlightedSignature={highlightedSignature}
        />
      );
    },
    [highlightedSignature, linkedWallets],
  );

  const renderFooter = () => null;

  const linkedWalletAddresses = useMemo(
    () => linkedWallets.map((wallet: any) => wallet.address),
    [linkedWallets],
  );

  const handleCloseTransactionDetail = useCallback(() => {
    const signature = selectedTransaction?.signature;
    setShowTransactionDetail(false);

    if (!signature) {
      return;
    }

    setHighlightedSignature(signature);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedSignature((current) =>
        current === signature ? null : current,
      );
      highlightTimeoutRef.current = null;
    }, 2000);
  }, [selectedTransaction?.signature]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const focusSignature = route.params?.focusSignature;
    const focusNonce = route.params?.focusNonce;

    if (!focusSignature || transactions.length === 0) {
      return;
    }

    const focusKey = `${focusSignature}:${focusNonce ?? "default"}`;
    if (lastHandledFocusKeyRef.current === focusKey) {
      return;
    }

    const target = transactions.find(
      (transaction) => transaction.signature === focusSignature,
    );

    if (!target) {
      return;
    }

    lastHandledFocusKeyRef.current = focusKey;
    setSelectedTransaction(target);
    setShowTransactionDetail(true);
  }, [route.params?.focusNonce, route.params?.focusSignature, transactions]);

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

  const renderTransactionDetail = () => {
    if (!selectedTransaction) return null;

    // Get all linked wallet addresses
    const linkedWalletAddresses = linkedWallets.map(
      (wallet: any) => wallet.address,
    );

    // Check if this is an outbound transaction (from any of our wallets)
    const isOutbound = linkedWalletAddresses.includes(
      selectedTransaction.source,
    );
    // Check if this is an inbound transaction (to any of our wallets)
    const isInbound = linkedWalletAddresses.includes(
      selectedTransaction.destination,
    );

    const amountUnit = selectedTransaction.amountUnit ?? "SOL";
    const formattedDate = selectedTransaction.timestamp
      ? new Date(selectedTransaction.timestamp).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "N/A";

    return (
      <View style={styles.transactionDetailContainer}>
        <View style={styles.transactionDetailHeader}>
          <TouchableOpacity onPress={handleCloseTransactionDetail}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.transactionDetailTitle}>
            {isOutbound ? "Sent" : isInbound ? "Received" : "Transaction"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.transactionDetailContent}>
          <View style={styles.transactionDetailIcon}>
            {isOutbound ? (
              <ArrowUpRight size={40} color="#FF4D4D" />
            ) : isInbound ? (
              <ArrowDownLeft size={40} color="#00FFB3" />
            ) : (
              <Info size={40} color="#7F56D9" />
            )}
          </View>

          <Text style={styles.transactionDetailAmount}>
            {isOutbound
              ? `- ${formatAmount(selectedTransaction.amount)} ${amountUnit}`
              : isInbound
                ? `+ ${formatAmount(selectedTransaction.amount)} ${amountUnit}`
                : `${formatAmount(selectedTransaction.amount)} ${amountUnit}`}
          </Text>

          <View style={styles.transactionDetailInfo}>
            <View style={styles.transactionDetailRow}>
              <Text style={styles.transactionDetailLabel}>Date</Text>
              <Text style={styles.transactionDetailValue}>{formattedDate}</Text>
            </View>

            <View style={styles.transactionDetailRow}>
              <Text style={styles.transactionDetailLabel}>Status</Text>
              <Text
                style={[
                  styles.transactionDetailValue,
                  selectedTransaction.status === "success"
                    ? styles.statusSuccess
                    : styles.statusFailed,
                ]}
              >
                {selectedTransaction.status === "success"
                  ? "Succeeded"
                  : "Failed"}
              </Text>
            </View>

            <View style={styles.transactionDetailRow}>
              <Text style={styles.transactionDetailLabel}>From</Text>
              <Text style={styles.transactionDetailValue}>
                {formatAddress(selectedTransaction.source)}
              </Text>
            </View>

            <View style={styles.transactionDetailRow}>
              <Text style={styles.transactionDetailLabel}>To</Text>
              <Text style={styles.transactionDetailValue}>
                {formatAddress(selectedTransaction.destination)}
              </Text>
            </View>

            <View style={styles.transactionDetailRow}>
              <Text style={styles.transactionDetailLabel}>Network</Text>
              <Text style={styles.transactionDetailValue}>Solana</Text>
            </View>

            {typeof selectedTransaction.fee === "number" && (
              <View style={styles.transactionDetailRow}>
                <Text style={styles.transactionDetailLabel}>Network Fee</Text>
                <Text style={styles.transactionDetailValue}>
                  {formatAmount(selectedTransaction.fee)} SOL
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.viewOnSolscanButton}
            onPress={() => {
              const solscanUrl = `https://solscan.io/tx/${selectedTransaction.signature}`;
              Linking.openURL(solscanUrl);
            }}
          >
            <Text style={styles.viewOnSolscanButtonText}>View on Solscan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recent Activity</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerAction}>
            <Search size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <Info size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={groupedTransactions}
        renderItem={renderTransactionGroup}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <IncomeExpenseFlowChart
            transactions={transactions}
            linkedWalletAddresses={linkedWalletAddresses}
          />
        }
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
            <Text style={styles.emptyStateText}>
              {transactions.length === 0
                ? "No transactions found"
                : "Loading transactions..."}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Found {transactions.length} transactions
            </Text>
          </View>
        }
        extraData={`${transactions.length}-${highlightedSignature ?? ""}`}
      />

      {/* Transaction Detail Modal */}
      {showTransactionDetail && renderTransactionDetail()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
  },
  headerAction: {
    padding: 8,
  },
  listContent: {
    paddingVertical: 12,
  },
  emptyState: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginTop: 24,
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
  },
  emptyStateSubtext: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
    marginTop: 8,
  },
  transactionGroup: {
    marginBottom: 24,
  },
  transactionGroupDate: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontWeight: "600",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  transactionItemHighlighted: {
    backgroundColor: "rgba(127, 86, 217, 0.18)",
    borderLeftWidth: 3,
    borderLeftColor: "#7F56D9",
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  transactionContent: {
    flex: 1,
  },
  transactionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  transactionAddress: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  transactionWallet: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmountContainer: {
    alignItems: "flex-end",
  },
  transactionAmount: {
    color: "#00FFB3",
    fontWeight: "600",
    fontSize: 16,
  },
  transactionAmountOutbound: {
    color: "#FF4D4D",
  },
  transactionDetailContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
    zIndex: 1000,
  },
  transactionDetailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  transactionDetailTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  transactionDetailContent: {
    flex: 1,
    padding: 24,
    alignItems: "center",
  },
  transactionDetailIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  transactionDetailAmount: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 32,
  },
  transactionDetailInfo: {
    width: "100%",
    marginBottom: 32,
  },
  transactionDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  transactionDetailLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  transactionDetailValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  statusSuccess: {
    color: "#00FFB3",
  },
  statusFailed: {
    color: "#FF4D4D",
  },
  viewOnSolscanButton: {
    width: "100%",
    backgroundColor: "#7F56D9",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  viewOnSolscanButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ActivityScreen;
