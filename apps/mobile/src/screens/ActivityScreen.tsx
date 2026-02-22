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

  // Cache expiration time (5 minutes)
  const CACHE_EXPIRATION = 5 * 60 * 1000;

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

        // Try to find a recognizable instruction
        let parsedInstruction = null;
        let transactionType:
          | "transfer"
          | "token_transfer"
          | "stake_delegate"
          | "stake_withdraw"
          | "nft_transfer"
          | "swap" = "transfer";
        let amount = 0;
        let amountUnit = "SOL";
        let source = "";
        let destination = "";

        // Check for different types of transactions
        for (const instruction of instructions) {
          const parsed = instruction?.parsed;
          if (!parsed?.info) {
            continue;
          }

          const program = instruction?.program;
          const type = parsed?.type;

          // System transfers
          if (program === "system" && type === "transfer") {
            parsedInstruction = instruction;
            transactionType = "transfer";
            const info = parsed.info;
            source = info.source || info.from || "";
            destination = info.destination || info.to || "";
            const lamports = Number(info.lamports ?? info.amount ?? 0);
            amount = lamports / LAMPORTS_PER_SOL;
            amountUnit = "SOL";
            break;
          }

          // SPL Token transfers
          if (
            program === "spl-token" &&
            (type === "transfer" || type === "transferChecked")
          ) {
            parsedInstruction = instruction;
            transactionType = "token_transfer";
            const info = parsed.info;
            source =
              info.source || info.authority || info.owner || info.from || "";
            destination = info.destination || info.recipient || info.to || "";
            const uiAmount = info.tokenAmount?.uiAmount;
            const uiAmountString = info.tokenAmount?.uiAmountString;
            amount =
              typeof uiAmount === "number"
                ? uiAmount
                : Number(uiAmountString ?? info.amount ?? 0);
            amountUnit = "TOKEN";
            break;
          }

          // Staking (delegate stake)
          if (program === "stake" && type === "delegate") {
            parsedInstruction = instruction;
            transactionType = "stake_delegate";
            const info = parsed.info;
            source = info.stakeAccount || "";
            destination = info.voter || info.delegate || "";
            // For staking, we don't have a direct amount, but we can infer it from the stake account
            amount = 0; // We'd need to get the stake amount from the stake account
            amountUnit = "SOL";
            break;
          }

          // Staking (withdraw stake)
          if (program === "stake" && type === "withdraw") {
            parsedInstruction = instruction;
            transactionType = "stake_withdraw";
            const info = parsed.info;
            source = info.stakeAccount || "";
            destination = info.destination || "";
            const lamports = Number(info.lamports ?? info.amount ?? 0);
            amount = lamports / LAMPORTS_PER_SOL;
            amountUnit = "SOL";
            break;
          }

          // NFT transfers (SPL Token with decimals 0)
          if (
            program === "spl-token" &&
            (type === "transfer" || type === "transferChecked")
          ) {
            const info = parsed.info;
            const decimals = info.tokenAmount?.decimals;
            if (decimals === 0) {
              parsedInstruction = instruction;
              transactionType = "nft_transfer";
              source =
                info.source || info.authority || info.owner || info.from || "";
              destination = info.destination || info.recipient || info.to || "";
              amount = 1; // NFTs are usually transferred one at a time
              amountUnit = "NFT";
              break;
            }
          }

          // Swap transactions (detected by multiple token transfers)
          if (
            program === "spl-token" &&
            (type === "transfer" || type === "transferChecked")
          ) {
            // This is a simplistic check - real swap detection would be more complex
            transactionType = "swap";
            parsedInstruction = instruction;
            const info = parsed.info;
            source =
              info.source || info.authority || info.owner || info.from || "";
            destination = info.destination || info.recipient || info.to || "";
            const uiAmount = info.tokenAmount?.uiAmount;
            const uiAmountString = info.tokenAmount?.uiAmountString;
            amount =
              typeof uiAmount === "number"
                ? uiAmount
                : Number(uiAmountString ?? info.amount ?? 0);
            amountUnit = "TOKEN";
            break;
          }
        }

        if (!parsedInstruction) {
          return null;
        }

        if (!source || !destination) {
          return null;
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
          type: transactionType,
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

  // Fetch transactions for a single wallet
  const fetchWalletTransactions = useCallback(
    async (
      walletAddress: string,
      limit: number = 20,
      lastSignature?: string,
    ) => {
      try {
        // Check if we have cached transactions that are not expired
        const cachedData = transactionCache[walletAddress];
        const now = Date.now();

        if (cachedData && now - cachedData.timestamp < CACHE_EXPIRATION) {
          if (__DEV__) {
            console.log(
              `Using cached transactions for wallet: ${walletAddress}`,
            );
          }
          return cachedData.transactions;
        }

        if (__DEV__) {
          console.log(`Fetching transactions for wallet: ${walletAddress}`);
        }
        const signatures = await rpcService.getSignaturesForAddress(
          walletAddress,
          limit,
          lastSignature,
        );

        if (__DEV__) {
          console.log(
            `Got ${signatures.length} signatures for wallet: ${walletAddress}`,
          );
        }

        if (signatures.length === 0) {
          // Cache empty result
          setTransactionCache((prev) => ({
            ...prev,
            [walletAddress]: {
              transactions: [],
              timestamp: now,
            },
          }));
          return [];
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
          `Failed to fetch transactions for wallet ${walletAddress}:`,
          error,
        );
        return [];
      }
    },
    [parseTransaction, transactionCache, CACHE_EXPIRATION],
  );

  // Fetch transactions for all linked wallets
  const fetchTransactions = useCallback(
    async (isLoadMore = false) => {
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
        const limit = 20;

        // Fetch transactions for each wallet in parallel
        const allTransactionsPromises = wallets.map((wallet: any) =>
          fetchWalletTransactions(wallet.address, limit),
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

        // Sort transactions by timestamp in descending order
        const sortedTransactions = allTransactions.sort(
          (a: Transaction, b: Transaction) => {
            const dateA = new Date(a.timestamp).getTime();
            const dateB = new Date(b.timestamp).getTime();
            return dateB - dateA;
          },
        );

        // Limit total transactions to avoid overwhelming the UI
        const MAX_TOTAL_TRANSACTIONS = 100;
        const limitedTransactions = sortedTransactions.slice(
          0,
          MAX_TOTAL_TRANSACTIONS,
        );

        if (__DEV__) {
          console.log(
            `Setting ${limitedTransactions.length} sorted transactions`,
          );
        }
        setTransactions(limitedTransactions);
        setHasMore(false); // For global view, we'll just load a reasonable amount at once
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
        setHasMore(true);
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
      setHasMore(true);
      await fetchTransactions(false);
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTransactions]);

  const loadMore = useCallback(async () => {
    // For global transaction view, we don't support load more
    // We load a reasonable amount of transactions at once
    console.log("Load more not supported for global transaction view");
  }, []);

  const handleTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetail(true);
  };

  const renderTransactionItem = ({ item }: ListRenderItemInfo<Transaction>) => {
    // Get all linked wallet addresses
    const linkedWalletAddresses = linkedWallets.map(
      (wallet: any) => wallet.address,
    );

    // Check if this is an outbound transaction (from any of our wallets)
    const isOutbound = linkedWalletAddresses.includes(item.source);
    // Check if this is an inbound transaction (to any of our wallets)
    const isInbound = linkedWalletAddresses.includes(item.destination);

    // If neither, it's not related to our wallets (shouldn't happen)
    if (!isOutbound && !isInbound) {
      return null;
    }

    const amountUnit = item.amountUnit ?? "SOL";
    const counterpartyAddress = isOutbound ? item.destination : item.source;
    const formattedCounterparty = formatAddress(counterpartyAddress);

    // Get transaction title and icon based on transaction type
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
        style={styles.transactionItem}
        onPress={() => handleTransactionDetail(item)}
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
          {/* Show which wallet this transaction is related to */}
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
          <TouchableOpacity onPress={() => setShowTransactionDetail(false)}>
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
