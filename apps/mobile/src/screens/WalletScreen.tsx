import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useSolana } from "../context/SolanaContext";
import { useWalletStore } from "../store/walletStore";
import { formatUsd, formatAddress } from "../utils/format";
import { DetectedWalletApp, LinkedWallet } from "../types/wallet";
import * as Haptics from "expo-haptics";
import { WalletOption } from "../components/wallet/WalletOption";
import { toast } from "../components/common/ErrorToast";

const HEADER_HEIGHT = 78;

const WalletScreen = () => {
  const {
    refreshBalance,
    refreshWalletDetection,
    startAuthorization,
    finalizeAuthorization,
    availableWallets,
    detectingWallets,
    sendSol,
  } = useSolana();

  // Use wallet store for state management
  const {
    linkedWallets,
    activeWallet,
    totalBalance,
    totalUsdValue,
    detailedBalances,
    setActiveWallet,
    removeWallet,
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<
    "manage" | "connect"
  >("connect");

  const activeWalletBalanceSol = activeWallet
    ? detailedBalances[activeWallet.address]?.balance || 0
    : 0;

  const activeWalletLabel =
    activeWallet?.label ||
    (activeWallet ? formatAddress(activeWallet.address) : "Select a wallet");

  const accountMetaText =
    linkedWallets.length > 0
      ? `${linkedWallets.length} connected${
          activeWallet ? ` • ${activeWalletBalanceSol.toFixed(4)} SOL` : ""
        }`
      : "Link Phantom, Backpack, or any MWA wallet";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshPromises: Array<Promise<any>> = [
        refreshWalletDetection().catch((err: any) =>
          console.warn("Wallet detection refresh failed", err),
        ),
        ...linkedWallets.map((wallet: LinkedWallet) =>
          refreshBalance(wallet.address).catch((err: any) => {
            console.warn(`Balance refresh failed for ${wallet.address}`, err);
          }),
        ),
      ];

      await Promise.all(refreshPromises);
    } catch (err: any) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, refreshBalance, refreshWalletDetection]);

  const openAccountModal = useCallback(
    (overrideMode?: "manage" | "connect") => {
      const nextMode =
        overrideMode ??
        (linkedWallets.length > 0 ? "manage" : ("connect" as const));
      setAccountModalMode(nextMode);
      setConnectModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [linkedWallets.length],
  );

  const handleConnectPress = useCallback(() => {
    openAccountModal();
  }, [openAccountModal]);

  const handleCycleWallet = useCallback(() => {
    if (linkedWallets.length === 0) {
      openAccountModal("connect");
      return;
    }

    if (!activeWallet) {
      setActiveWallet(linkedWallets[0]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const currentIndex = linkedWallets.findIndex(
      (wallet) => wallet.address === activeWallet.address,
    );
    const nextWallet =
      linkedWallets[
        (currentIndex + 1 + linkedWallets.length) % linkedWallets.length
      ];
    setActiveWallet(nextWallet);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet, linkedWallets, openAccountModal, setActiveWallet]);

  const handleStartConnect = useCallback(
    async (walletChoice?: DetectedWalletApp) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const preview = await startAuthorization(walletChoice);
        const accounts = await finalizeAuthorization(preview);
        await Promise.all(
          accounts.map((account: LinkedWallet) =>
            refreshBalance(account.address).catch((err: any) =>
              console.warn("Balance refresh failed post-connect", err),
            ),
          ),
        );
        setConnectModalVisible(false);
      } catch (err: any) {
        console.warn("Connect flow failed", err);
        Alert.alert("Connect failed", "Please try again.");
      }
    },
    [finalizeAuthorization, refreshBalance, startAuthorization],
  );

  const handleSelectLinkedWallet = useCallback(
    (wallet: LinkedWallet) => {
      setActiveWallet(wallet);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setConnectModalVisible(false);
    },
    [setActiveWallet],
  );

  const handleRemoveLinkedWallet = useCallback(
    (wallet: LinkedWallet) => {
      Alert.alert(
        "Remove wallet",
        `Are you sure you want to remove ${wallet.label || wallet.address}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              removeWallet(wallet.address);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
            },
          },
        ],
      );
    },
    [removeWallet],
  );

  const handleSend = useCallback(async () => {
    if (!activeWallet) {
      Alert.alert("Select wallet", "Please choose a wallet first.");
      return;
    }
    const amount = parseFloat(sendAmount);
    if (!sendRecipient.trim() || Number.isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid input", "Enter a valid recipient and amount.");
      return;
    }
    if (amount > activeWalletBalanceSol) {
      Alert.alert(
        "Insufficient balance",
        `You can send up to ${activeWalletBalanceSol.toFixed(4)} SOL.`,
      );
      return;
    }
    setSending(true);
    try {
      const signature = await sendSol(sendRecipient.trim(), amount, {
        fromAddress: activeWallet.address,
      });
      await refreshBalance(activeWallet.address).catch((err: any) =>
        console.warn("Balance refresh failed after send", err),
      );
      setSendModalVisible(false);
      setSendRecipient("");
      setSendAmount("");
      toast.show({ message: "Transaction sent successfully", type: "success" });
    } catch (err: any) {
      console.warn("Send failed", err);
      toast.show({
        message:
          "Failed to send transaction. Please check details and try again.",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  }, [
    activeWallet,
    activeWalletBalanceSol,
    refreshBalance,
    sendAmount,
    sendRecipient,
    sendSol,
  ]);

  const handleReceive = useCallback(() => {
    if (!activeWallet) {
      Alert.alert("No wallet", "Connect a wallet to receive.");
      return;
    }
    setReceiveModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet]);

  const handleCopyAddress = useCallback(async () => {
    if (!activeWallet) {
      return;
    }
    try {
      await Clipboard.setStringAsync(activeWallet.address);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        message: "Wallet address copied to clipboard",
        type: "success",
      });
    } catch (err) {
      console.warn("Copy failed", err);
      toast.show({
        message: "Failed to copy address. Try again.",
        type: "error",
      });
    }
  }, [activeWallet]);

  const handleShareAddress = useCallback(async () => {
    if (!activeWallet) {
      return;
    }
    try {
      await Share.share({
        message: `Send SOL to ${activeWallet.address}`,
      });
    } catch (err) {
      console.warn("Share failed", err);
    }
  }, [activeWallet]);

  const handleUseMaxAmount = useCallback(() => {
    if (!activeWallet) {
      return;
    }
    setSendAmount(activeWalletBalanceSol.toFixed(4));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet, activeWalletBalanceSol]);

  const handleStub = useCallback((label: string) => {
    Alert.alert(label, "Coming soon");
  }, []);

  const aggregatedTokens = useMemo(() => {
    const tokenMap = new Map<
      string,
      {
        mint: string;
        symbol?: string;
        name?: string;
        balance: number;
        usdValue: number;
        decimals: number;
      }
    >();

    linkedWallets.forEach((wallet) => {
      const walletTokens = detailedBalances[wallet.address]?.tokens || [];
      walletTokens.forEach((token) => {
        const existing = tokenMap.get(token.mint);
        if (existing) {
          existing.balance += token.balance;
          existing.usdValue += token.usdValue;
          if (!existing.symbol && token.symbol) {
            existing.symbol = token.symbol;
          }
          if (!existing.name && token.name) {
            existing.name = token.name;
          }
        } else {
          tokenMap.set(token.mint, { ...token });
        }
      });
    });

    return Array.from(tokenMap.values()).sort(
      (a, b) => b.usdValue - a.usdValue,
    );
  }, [detailedBalances, linkedWallets]);

  const renderAvailableWallets = useMemo(() => {
    if (detectingWallets) {
      return (
        <View style={styles.modalLoading}>
          <ActivityIndicator color="#7F56D9" />
          <Text style={styles.modalLoadingText}>Detecting wallets...</Text>
        </View>
      );
    }
    if (availableWallets.length === 0) {
      return (
        <View style={styles.emptyWalletDetection}>
          <Text style={styles.emptyWalletDetectionText}>
            No compatible wallets detected nearby. Launch Phantom, Backpack, or
            another MWA-compatible wallet, then try again.
          </Text>
        </View>
      );
    }
    return availableWallets.map((wallet: DetectedWalletApp) => (
      <WalletOption
        key={wallet.id}
        wallet={wallet}
        onPress={() => handleStartConnect(wallet)}
      />
    ));
  }, [availableWallets, detectingWallets, handleStartConnect]);

  const showManageAccounts =
    accountModalMode === "manage" && linkedWallets.length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.accountCard}
          onPress={handleConnectPress}
          activeOpacity={0.9}
        >
          <View style={styles.accountAvatar}>
            {activeWallet ? (
              <View style={styles.userAvatar}>
                <Text style={styles.avatarText}>
                  {activeWalletLabel.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={styles.connectAvatar}>
                <Feather name="plus" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.accountDetails}>
            <Text style={styles.accountName} numberOfLines={1}>
              {activeWallet ? activeWalletLabel : "Connect Wallet"}
            </Text>
            <Feather
              name="chevron-down"
              size={14}
              color="rgba(255,255,255,0.7)"
            />
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Solana Wallets</Text>
          <View style={styles.headerPill}>
            <View style={styles.headerPillDot} />
            <Text style={styles.headerPillText}>Mainnet</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTotalLabel}>Total</Text>
          <Text style={styles.headerTotalValue}>
            {formatUsd(totalUsdValue)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: HEADER_HEIGHT + 12 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7F56D9"
            colors={["#7F56D9"]}
          />
        }
      >
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["#A855F7", "#6366F1", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.pill}>
                <Feather name="server" size={14} color="#E9D8FD" />
                <Text style={styles.pillText}>Solana Mainnet</Text>
              </View>
              <View style={styles.pillMuted}>
                <Feather name="shield" size={14} color="#DAD5FF" />
                <Text style={styles.pillMutedText}>Secure session</Text>
              </View>
            </View>

            <View style={styles.heroBalanceBlock}>
              <Text style={styles.balanceLabel}>Portfolio</Text>
              <Text style={styles.balanceValue}>
                {formatUsd(totalUsdValue)}
              </Text>
              <Text style={styles.balanceSol}>
                {totalBalance.toFixed(4)} SOL
              </Text>
            </View>

            <View style={styles.heroWalletRow}>
              <View style={styles.avatar}>
                <Feather name="key" size={18} color="#0B1221" />
              </View>
              <View style={styles.walletMeta}>
                <Text style={styles.walletMetaLabel}>Active wallet</Text>
                <Text style={styles.walletMetaValue}>{activeWalletLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.switchButton}
                onPress={handleConnectPress}
                activeOpacity={0.9}
              >
                <Text style={styles.switchButtonText}>
                  {activeWallet ? "Manage" : "Select"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroActionButton}
                onPress={() => setSendModalVisible(true)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0.08)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroActionCircle}
                >
                  <Feather name="arrow-up-right" size={18} color="#0B1221" />
                </LinearGradient>
                <Text style={styles.heroActionText}>Send</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroActionButton}
                onPress={handleReceive}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.08)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroActionCircle}
                >
                  <Feather name="arrow-down-left" size={18} color="#0B1221" />
                </LinearGradient>
                <Text style={styles.heroActionText}>Receive</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroActionButton}
                onPress={() => handleStub("Stake")}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.08)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroActionCircle}
                >
                  <Feather name="trending-up" size={18} color="#0B1221" />
                </LinearGradient>
                <Text style={styles.heroActionText}>Stake</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {linkedWallets.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Total Portfolio</Text>
              <Text style={styles.summarySubtitle}>
                {linkedWallets.length} wallets connected
              </Text>
            </View>
            <View style={styles.summaryTotalsRow}>
              <View style={styles.summaryTotalsBlock}>
                <Text style={styles.summaryTotalsLabel}>Total Value</Text>
                <Text style={styles.summaryTotalsValue}>
                  {formatUsd(totalUsdValue)}
                </Text>
              </View>
              <View style={styles.summaryTotalsDivider} />
              <View style={styles.summaryTotalsBlock}>
                <Text style={styles.summaryTotalsLabel}>Total SOL</Text>
                <Text style={styles.summaryTotalsValue}>
                  {totalBalance.toFixed(4)} SOL
                </Text>
              </View>
            </View>
            <View style={styles.summaryTokenHeader}>
              <Text style={styles.summaryTokenHeaderText}>Tokens</Text>
              <Text style={styles.summaryTokenCount}>
                {aggregatedTokens.length} types
              </Text>
            </View>
            <View style={styles.tokenList}>
              {aggregatedTokens.length > 0 ? (
                aggregatedTokens.map((token) => {
                  const label = token.symbol || token.name || token.mint;
                  const secondary =
                    token.symbol && token.name && token.symbol !== token.name
                      ? token.name
                      : token.mint;
                  return (
                    <View key={token.mint} style={styles.tokenRow}>
                      <View style={styles.tokenMeta}>
                        <Text style={styles.tokenSymbol}>{label}</Text>
                        <Text style={styles.tokenName}>{secondary}</Text>
                      </View>
                      <View style={styles.tokenValues}>
                        <Text style={styles.tokenAmount}>
                          {token.balance.toFixed(4)}
                        </Text>
                        <Text style={styles.tokenUsd}>
                          {formatUsd(token.usdValue)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.tokenEmpty}>
                  No tokens detected across connected wallets.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Connect Wallet Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={connectModalVisible}
          onRequestClose={() => setConnectModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {showManageAccounts ? "Wallet accounts" : "Connect a wallet"}
              </Text>
              {showManageAccounts ? (
                <>
                  <ScrollView>
                    {linkedWallets.map((wallet) => (
                      <WalletOption
                        key={wallet.address}
                        wallet={wallet}
                        isActive={wallet.address === activeWallet?.address}
                        onSelect={handleSelectLinkedWallet}
                        onRemove={() => handleRemoveLinkedWallet(wallet)}
                      />
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.modalHelperButton}
                    onPress={() => setAccountModalMode("connect")}
                  >
                    <Feather name="plus" size={14} color="#C7B5FF" />
                    <Text style={styles.modalHelperButtonText}>
                      Link a new wallet
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ScrollView>{renderAvailableWallets}</ScrollView>
                  {linkedWallets.length > 0 && (
                    <TouchableOpacity
                      style={styles.modalHelperButton}
                      onPress={() => setAccountModalMode("manage")}
                    >
                      <Feather name="credit-card" size={14} color="#C7B5FF" />
                      <Text style={styles.modalHelperButtonText}>
                        Manage linked wallets
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setConnectModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Send Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={sendModalVisible}
          onRequestClose={() => setSendModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Send SOL</Text>
              <TextInput
                placeholder="Recipient address"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.input}
                value={sendRecipient}
                onChangeText={setSendRecipient}
                autoCapitalize="none"
              />
              <TextInput
                placeholder="Amount (SOL)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={styles.input}
                value={sendAmount}
                onChangeText={setSendAmount}
                keyboardType="decimal-pad"
              />
              {activeWallet && (
                <View style={styles.availableRow}>
                  <Text style={styles.availableLabel}>Available</Text>
                  <TouchableOpacity
                    onPress={handleUseMaxAmount}
                    style={styles.inlineActionButton}
                  >
                    <Text style={styles.inlineActionText}>
                      Use max ({activeWalletBalanceSol.toFixed(4)} SOL)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setSendModalVisible(false)}
                  disabled={sending}
                >
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimary, sending && styles.disabled]}
                  onPress={handleSend}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color="#0B1221" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Receive Modal */}
        <Modal
          animationType="slide"
          transparent
          visible={receiveModalVisible}
          onRequestClose={() => setReceiveModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Receive SOL</Text>
              {activeWallet ? (
                <>
                  <Text style={styles.receiveHint}>
                    Share this QR or address to receive funds.
                  </Text>
                  <View style={styles.qrWrapper}>
                    <QRCode
                      value={activeWallet.address}
                      size={180}
                      color="#FFFFFF"
                      backgroundColor="transparent"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.addressPill}
                    onLongPress={handleCopyAddress}
                    onPress={handleCopyAddress}
                  >
                    <Text style={styles.addressPillText}>
                      {activeWallet.address}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.receiveActions}>
                    <TouchableOpacity
                      style={styles.receiveActionButton}
                      onPress={handleCopyAddress}
                    >
                      <Feather name="copy" size={16} color="#0B1221" />
                      <Text style={styles.receiveActionText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.receiveActionButton}
                      onPress={handleShareAddress}
                    >
                      <Feather name="share-2" size={16} color="#0B1221" />
                      <Text style={styles.receiveActionText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <Text style={styles.receiveHint}>
                  Connect a wallet to view your receive address.
                </Text>
              )}
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setReceiveModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050814",
  },
  container: {
    flex: 1,
    backgroundColor: "#050814",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(6, 10, 24, 0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    zIndex: 10,
    elevation: 8,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  accountAvatar: {
    marginRight: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(127, 86, 217, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  connectAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(127, 86, 217, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  accountDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  accountName: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 6,
  },
  headerCenter: {
    alignItems: "center",
    paddingHorizontal: 6,
  },
  headerTitle: {
    color: "#F8F5FF",
    fontWeight: "800",
    fontSize: 16,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  headerPillDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#66F2C3",
  },
  headerPillText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTotalLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  headerTotalValue: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.76)",
    fontSize: 13,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  balanceValue: {
    fontSize: 38,
    fontWeight: "900",
    color: "#F8F5FF",
    marginBottom: 4,
  },
  balanceSol: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.82)",
  },
  heroCard: {
    marginBottom: 12,
  },
  heroGradient: {
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 18, 33, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  pillText: {
    color: "#E9D8FD",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pillMuted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 18, 33, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  pillMutedText: {
    color: "#DAD5FF",
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  heroBalanceBlock: {
    marginBottom: 16,
  },
  heroWalletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  walletMeta: {
    flex: 1,
  },
  walletMetaLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginBottom: 2,
  },
  walletMetaValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  switchButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(11, 18, 33, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  switchButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  heroActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  heroActionButton: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  heroActionCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroActionText: {
    color: "#F8F5FF",
    fontWeight: "700",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  summarySubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  summaryTotalsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  summaryTotalsBlock: {
    flex: 1,
  },
  summaryTotalsLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryTotalsValue: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  summaryTotalsDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 12,
  },
  walletCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  walletHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
  },
  walletIdentity: {
    gap: 2,
  },
  walletName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  walletAddress: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  walletLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  activeBadge: {
    backgroundColor: "rgba(127, 86, 217, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127, 86, 217, 0.38)",
  },
  activeBadgeText: {
    color: "#7F56D9",
    fontSize: 11,
    fontWeight: "700",
  },
  walletBalance: {
    marginBottom: 16,
  },
  walletBalanceSol: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  walletBalanceUsd: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  tokenList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
    gap: 8,
  },
  summaryTokenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  summaryTokenHeaderText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  summaryTokenCount: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  tokenMeta: {
    flex: 1,
  },
  tokenSymbol: {
    color: "#F2EEFF",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  tokenName: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 2,
  },
  tokenAmount: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
  },
  tokenValues: {
    alignItems: "flex-end",
  },
  tokenUsd: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  tokenEmpty: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  walletActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  walletAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  walletActionText: {
    color: "#C7B5FF",
    fontWeight: "600",
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#0F1526",
    borderRadius: 18,
    padding: 20,
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalClose: {
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#C7B5FF",
    fontWeight: "700",
  },
  modalHelperButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  modalHelperButtonText: {
    color: "#C7B5FF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
  modalLoadingText: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    padding: 14,
    color: "#FFFFFF",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: "#9B8CFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  modalPrimaryText: {
    color: "#0B1221",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  availableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  availableLabel: {
    color: "rgba(255,255,255,0.7)",
  },
  inlineActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  inlineActionText: {
    color: "#9B8CFF",
    fontWeight: "700",
    fontSize: 13,
  },
  receiveHint: {
    color: "rgba(255,255,255,0.72)",
    marginBottom: 16,
    textAlign: "center",
  },
  qrWrapper: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  receiveActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  receiveActionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#9B8CFF",
    paddingVertical: 12,
    borderRadius: 12,
  },
  receiveActionText: {
    color: "#0B1221",
    fontWeight: "700",
  },
  addressPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  addressPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
  },
  emptyWalletDetection: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWalletDetectionText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default WalletScreen;
