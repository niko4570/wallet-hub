import React, { useState, useCallback, useEffect, useMemo } from "react";
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
import { formatAddress, formatAmount } from "../utils/format";
import { useWalletStore } from "../store/walletStore";
import { rpcService } from "../services";
import { Transaction } from "../types";
import { SkeletonTransaction } from "../components/common/SkeletonLoader";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Search,
  X,
} from "lucide-react-native";

const ActivityScreen = () => {
  const { linkedWallets, activeWallet } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastSignature, setLastSignature] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);

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
        if (__DEV__) {
          console.log("No active wallet, setting transactions to empty");
        }
        setTransactions([]);
        return;
      }

      try {
        if (__DEV__) {
          console.log(
            `Fetching transactions for wallet: ${activeWallet.address}`,
          );
        }
        const limit = 20;
        if (__DEV__) {
          console.log(
            `Getting signatures with limit: ${limit}, last signature: ${currentLastSignature}`,
          );
        }
        const signatures = await rpcService.getSignaturesForAddress(
          activeWallet.address,
          limit,
          isLoadMore ? currentLastSignature : undefined,
        );

        if (__DEV__) {
          console.log(`Got ${signatures.length} signatures`);
        }

        if (signatures.length === 0) {
          if (__DEV__) {
            console.log("No signatures found");
          }
          if (!isLoadMore) {
            setTransactions([]);
          }
          setHasMore(false);
          return;
        }

        if (__DEV__) {
          console.log(`Processing ${signatures.length} signatures`);
        }
        const transactionPromises: Array<Promise<Transaction | null>> =
          signatures.map(async (sig) => {
            try {
              if (__DEV__) {
                console.log(
                  `Fetching transaction for signature: ${sig.signature}`,
                );
              }
              const tx = await rpcService.getTransaction(sig.signature);
              const parsed = parseTransaction(
                tx,
                sig.signature,
                sig.blockTime,
                sig.status,
              );
              if (__DEV__) {
                console.log(
                  `Parsed transaction: ${parsed ? "success" : "failed"}`,
                );
              }
              return parsed;
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

        if (__DEV__) {
          console.log(`Got ${validTransactions.length} valid transactions`);
        }
        if (__DEV__) {
          console.log("Valid transactions count:", validTransactions.length);
        }

        // Batch update state to reduce re-renders
        if (isLoadMore) {
          if (__DEV__) {
            console.log(`Appending ${validTransactions.length} transactions`);
          }
          setTransactions((prev) => {
            const newTransactions = [...prev, ...validTransactions];
            if (__DEV__) {
              console.log(
                `Total transactions after append: ${newTransactions.length}`,
              );
            }
            return newTransactions;
          });
        } else {
          if (__DEV__) {
            console.log(`Setting ${validTransactions.length} transactions`);
          }
          setTransactions(validTransactions);
        }

        if (validTransactions.length > 0) {
          setLastSignature(signatures[signatures.length - 1].signature);
        }

        setHasMore(signatures.length === limit);
        if (__DEV__) {
          console.log(`Has more: ${signatures.length === limit}`);
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        if (!isLoadMore) {
          setTransactions([]);
        }
      }
    },
    [activeWallet, parseTransaction],
  );

  // Load data when active wallet changes or tab changes
  useEffect(() => {
    if (__DEV__) {
      console.log(
        `useEffect triggered - activeWallet: ${activeWallet?.address}`,
      );
    }

    if (activeWallet) {
      const loadData = async () => {
        setLoading(true);
        try {
          setLastSignature(undefined);
          setHasMore(true);
          if (__DEV__) {
            console.log(
              `Calling fetchTransactions with activeWallet: ${activeWallet.address}`,
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
    } else {
      if (__DEV__) {
        console.log(`No active wallet, setting transactions to empty`);
      }
      setTransactions([]);
      setLoading(false);
    }
  }, [activeWallet, fetchTransactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setLastSignature(undefined);
      setHasMore(true);
      await fetchTransactions(false);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      try {
        await fetchTransactions(true, lastSignature);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, fetchTransactions, lastSignature]);

  const handleTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetail(true);
  };

  const renderTransactionItem = ({ item }: ListRenderItemInfo<Transaction>) => {
    const isOutbound = item.source === activeWallet?.address;
    const amountUnit = item.amountUnit ?? "SOL";
    const counterpartyAddress = isOutbound ? item.destination : item.source;
    const formattedCounterparty = formatAddress(counterpartyAddress);

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => handleTransactionDetail(item)}
      >
        <View style={styles.transactionIcon}>
          {isOutbound ? (
            <ArrowUpRight size={20} color="#FF4D4D" />
          ) : (
            <ArrowDownLeft size={20} color="#00FFB3" />
          )}
        </View>
        <View style={styles.transactionContent}>
          <Text style={styles.transactionTitle}>
            {isOutbound ? "Sent" : "Received"}
          </Text>
          <Text style={styles.transactionAddress}>
            {isOutbound
              ? `To ${formattedCounterparty}`
              : `From ${formattedCounterparty}`}
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
  };

  const renderTransactionGroup = ({
    item,
  }: ListRenderItemInfo<{ date: string; transactions: Transaction[] }>) => {
    return (
      <View style={styles.transactionGroup}>
        <Text style={styles.transactionGroupDate}>{item.date}</Text>
        {item.transactions.map((transaction) => (
          <View key={transaction.id}>
            {renderTransactionItem({
              item: transaction,
            } as ListRenderItemInfo<Transaction>)}
          </View>
        ))}
      </View>
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

  const renderTransactionDetail = () => {
    if (!selectedTransaction) return null;

    const isOutbound = selectedTransaction.source === activeWallet?.address;
    const amountUnit = selectedTransaction.amountUnit ?? "SOL";
    const formattedDate = new Date(
      selectedTransaction.timestamp,
    ).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return (
      <View style={styles.transactionDetailContainer}>
        <View style={styles.transactionDetailHeader}>
          <TouchableOpacity onPress={() => setShowTransactionDetail(false)}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.transactionDetailTitle}>
            {isOutbound ? "Sent" : "Received"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.transactionDetailContent}>
          <View style={styles.transactionDetailIcon}>
            {isOutbound ? (
              <ArrowUpRight size={40} color="#FF4D4D" />
            ) : (
              <ArrowDownLeft size={40} color="#00FFB3" />
            )}
          </View>

          <Text style={styles.transactionDetailAmount}>
            {isOutbound
              ? `- ${formatAmount(selectedTransaction.amount)} ${amountUnit}`
              : `+ ${formatAmount(selectedTransaction.amount)} ${amountUnit}`}
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
              <Text style={styles.transactionDetailLabel}>
                {isOutbound ? "To" : "From"}
              </Text>
              <Text style={styles.transactionDetailValue}>
                {formatAddress(
                  isOutbound
                    ? selectedTransaction.destination
                    : selectedTransaction.source,
                )}
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
        extraData={transactions.length}
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
