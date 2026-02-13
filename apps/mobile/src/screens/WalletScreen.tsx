import React, { useCallback, useMemo, useState, useEffect } from "react";
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
  Linking,
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
import { IconLoader } from "../components/common/IconLoader";
import { priceService } from "../services/priceService";
import { toast } from "../components/common/ErrorToast";

const WalletScreen = () => {
  const {
    refreshBalance,
    refreshWalletDetection,
    disconnect,
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
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [solPriceUsd, setSolPriceUsd] = useState(100); // Default value while loading

  const activeWalletBalanceSol = activeWallet
    ? detailedBalances[activeWallet.address]?.balance || 0
    : 0;

  const activeWalletLabel =
    activeWallet?.label ||
    (activeWallet ? formatAddress(activeWallet.address) : "Select a wallet");

  const fetchSolPrice = useCallback(async () => {
    try {
      const price = await priceService.getSolPriceInUsd();
      setSolPriceUsd(price);
    } catch (error) {
      console.warn("Failed to fetch SOL price:", error);
    }
  }, []);

  // Fetch SOL price on component mount only if there are linked wallets
  useEffect(() => {
    if (linkedWallets.length > 0) {
      fetchSolPrice();
    }
  }, [fetchSolPrice, linkedWallets.length]);

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

      // Only fetch SOL price if there are linked wallets
      if (linkedWallets.length > 0) {
        refreshPromises.push(fetchSolPrice());
      }

      await Promise.all(refreshPromises);
    } catch (err: any) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, refreshBalance, refreshWalletDetection, fetchSolPrice]);

  const handleSelectWallet = useCallback(
    (wallet: LinkedWallet) => {
      setActiveWallet(wallet);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [setActiveWallet],
  );

  const handleDisconnect = useCallback(
    (address: string) => {
      disconnect(address)
        .then(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        )
        .catch((err: any) => {
          console.warn("Disconnect failed", err);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    },
    [disconnect],
  );

  const handleConnectPress = useCallback(() => {
    setConnectModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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

  const renderAvailableWallets = useMemo(() => {
    if (detectingWallets) {
      return (
        <View style={styles.modalLoading}>
          <ActivityIndicator color="#7F56D9" />
          <Text style={styles.modalLoadingText}>Detecting wallets...</Text>
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
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
            <Text style={styles.balanceValue}>{formatUsd(totalUsdValue)}</Text>
            <Text style={styles.balanceSol}>{totalBalance.toFixed(4)} SOL</Text>
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
                {activeWallet ? "Switch" : "Connect"}
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

      {/* Linked Wallets */}
      <View style={styles.walletsSection}>
        <Text style={styles.sectionTitle}>Linked Wallets</Text>
        {linkedWallets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No wallets connected</Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnectPress}
            >
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : (
          linkedWallets.map((wallet: LinkedWallet) => {
            const isActiveWallet = activeWallet?.address === wallet.address;
            const walletBalance = detailedBalances[wallet.address];
            const walletBalanceSol = walletBalance?.balance || 0;
            const walletBalanceUsd = walletBalance?.usdValue || 0;

            return (
              <View key={wallet.address} style={styles.walletCard}>
                <View style={styles.walletHeader}>
                  <View style={styles.walletHeaderLeft}>
                    <View style={styles.walletIcon}>
                      <IconLoader
                        walletId={wallet.walletAppId || "unknown"}
                        size={36}
                      />
                    </View>
                    <Text style={styles.walletAddress}>
                      {formatAddress(wallet.address)}
                    </Text>
                    {wallet.label && (
                      <Text style={styles.walletLabel}>{wallet.label}</Text>
                    )}
                  </View>
                  {isActiveWallet && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
                <View style={styles.walletBalance}>
                  <Text style={styles.walletBalanceSol}>
                    {walletBalanceSol.toFixed(4)} SOL
                  </Text>
                  <Text style={styles.walletBalanceUsd}>
                    {formatUsd(walletBalanceUsd)}
                  </Text>
                </View>
                <View style={styles.walletActions}>
                  {!isActiveWallet && (
                    <TouchableOpacity
                      style={styles.walletAction}
                      onPress={() => handleSelectWallet(wallet)}
                    >
                      <Text style={styles.walletActionText}>Set Active</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.walletAction}
                    onPress={() => handleDisconnect(wallet.address)}
                  >
                    <Text style={styles.walletActionText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Connect Wallet Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={connectModalVisible}
        onRequestClose={() => setConnectModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a wallet</Text>
            <ScrollView>{renderAvailableWallets}</ScrollView>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050814",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
    gap: 16,
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
  walletsSection: {
    marginBottom: 24,
    marginTop: 8,
  },
  sectionTitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyStateText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
    marginBottom: 16,
  },
  connectButton: {
    backgroundColor: "#9B8CFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  connectButtonText: {
    color: "#0B1221",
    fontWeight: "700",
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
  walletAddress: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
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
});

export default WalletScreen;
