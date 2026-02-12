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
import { rpcService } from "../services";
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

  // Calculate transaction amount and determine direction
  const parseTransaction = useCallback(
    (
      tx: any,
      signature: string,
      blockTime: number | null,
      status: string,
      walletAddress: string,
    ) => {
      if (!tx || !tx.transaction) return null;

      const { transaction, meta } = tx;
      const instructions = transaction.message.instructions;

      // Look for transfer instructions
      for (const instruction of instructions) {
        const programIdBase58 =
          typeof instruction?.programId?.toBase58 === "function"
            ? instruction.programId.toBase58()
            : undefined;

        if (programIdBase58 === "11111111111111111111111111111111") {
          // System program transfer
          const data = instruction.data;
          if (data && data.length >= 8) {
            const lamports = parseInt(data.slice(0, 8), 16);
            const amount = lamports / LAMPORTS_PER_SOL;

            const keys = instruction.keys;
            if (keys?.length >= 2) {
              const source =
                typeof keys[0]?.pubkey?.toBase58 === "function"
                  ? keys[0].pubkey.toBase58()
                  : undefined;
              const destination =
                typeof keys[1]?.pubkey?.toBase58 === "function"
                  ? keys[1].pubkey.toBase58()
                  : undefined;

              if (!source || !destination) {
                continue;
              }

              return {
                id: signature,
                signature,
                source,
                destination,
                amount,
                status: status === "confirmed" ? "success" : "pending",
                timestamp: new Date(
                  blockTime ? blockTime * 1000 : Date.now(),
                ).toISOString(),
                type: "transfer",
              };
            }
          }
        }
      }

      return null;
    },
    [],
  );

  // Fetch transactions for active wallet
  const fetchTransactions = useCallback(
    async (isLoadMore = false) => {
      if (!activeWallet) {
        setTransactions([]);
        return;
      }

      try {
        const limit = 20;
        const signatures = await rpcService.getSignaturesForAddress(
          activeWallet.address,
          limit,
          isLoadMore ? lastSignature : undefined,
        );

        if (signatures.length === 0) {
          setHasMore(false);
          return;
        }

        const transactionPromises = signatures.map(async (sig) => {
          try {
            const tx = await rpcService.getTransaction(sig.signature);
            return parseTransaction(
              tx,
              sig.signature,
              sig.blockTime,
              sig.status,
              activeWallet.address,
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
    [activeWallet, lastSignature, parseTransaction],
  );

  // Fetch authorizations
  const fetchAuthorizations = useCallback(async () => {
    // For now, we'll use mock data for authorizations
    // In a real app, you would fetch this from your backend
    setAuthorizations([]);
  }, []);

  // Load data when active wallet changes or tab changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLastSignature(undefined);
      setHasMore(true);
      try {
        if (activeTab === "transactions") {
          await fetchTransactions();
        } else {
          await fetchAuthorizations();
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeWallet, activeTab, fetchTransactions, fetchAuthorizations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLastSignature(undefined);
    setHasMore(true);
    try {
      if (activeTab === "transactions") {
        await fetchTransactions();
      } else {
        await fetchAuthorizations();
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchTransactions, fetchAuthorizations]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore && activeTab === "transactions") {
      setLoadingMore(true);
      try {
        await fetchTransactions(true);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, activeTab, fetchTransactions]);

  const handleTransactionDetail = (signature: string) => {
    navigation.navigate("TransactionDetail", { signature });
  };

  const handleAuthorizationDetail = (authorizationId: string) => {
    navigation.navigate("AuthorizationDetail", { authorizationId });
  };

  const renderTransaction = ({ item }: ListRenderItemInfo<Transaction>) => {
    const isOutbound = item.source === activeWallet?.address;

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
                : styles.transactionStatusPending,
            ]}
          >
            <Text
              style={[
                styles.transactionStatusText,
                item.status === "success"
                  ? styles.transactionStatusTextSuccess
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
              ? `- ${formatAmount(item.amount)} SOL`
              : `+ ${formatAmount(item.amount)} SOL`}
          </Text>
          <Text style={styles.transactionAddress}>
            {isOutbound
              ? `To: ${formatAddress(item.destination)}`
              : `From: ${formatAddress(item.source)}`}
          </Text>
        </View>
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
  transactionAddress: {
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
