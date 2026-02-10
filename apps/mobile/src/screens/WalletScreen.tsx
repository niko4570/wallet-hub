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
} from "react-native";
import { useSolana } from "../hooks/useSolana";
import { formatUsd, formatAddress } from "../utils/format";
import { DetectedWalletApp } from "../types/wallet";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { WalletOption } from "../components/wallet/WalletOption";

const WalletScreen = () => {
  const {
    linkedWallets,
    activeWallet,
    refreshBalance,
    refreshWalletDetection,
    balances,
    selectActiveWallet,
    disconnect,
    startAuthorization,
    finalizeAuthorization,
    availableWallets,
    detectingWallets,
    sendSol,
  } = useSolana();

  const [refreshing, setRefreshing] = useState(false);
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);

  const totalBalanceLamports = linkedWallets.reduce(
    (sum, wallet) => sum + (balances[wallet.address] ?? 0),
    0,
  );

  const totalBalanceSol = totalBalanceLamports / LAMPORTS_PER_SOL;
  const totalBalanceUsd = totalBalanceSol * 100; // Mock USD value

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshWalletDetection().catch((err) =>
          console.warn("Wallet detection refresh failed", err),
        ),
        ...linkedWallets.map((wallet) =>
          refreshBalance(wallet.address).catch((err) => {
            console.warn(`Balance refresh failed for ${wallet.address}`, err);
          }),
        ),
      ]);
    } catch (err) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, refreshBalance, refreshWalletDetection]);

  const handleSelectWallet = useCallback(
    (address: string) => {
      selectActiveWallet(address);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [selectActiveWallet],
  );

  const handleDisconnect = useCallback(
    (address: string) => {
      disconnect(address)
        .then(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        )
        .catch((err) => {
          console.warn("Disconnect failed", err);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        });
    },
    [disconnect],
  );

  const handleConnectPress = useCallback(() => {
    setConnectModalVisible(true);
  }, []);

  const handleStartConnect = useCallback(
    async (walletChoice?: DetectedWalletApp) => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const preview = await startAuthorization(walletChoice);
        const accounts = await finalizeAuthorization(preview);
        await Promise.all(
          accounts.map((account) =>
            refreshBalance(account.address).catch((err) =>
              console.warn("Balance refresh failed post-connect", err),
            ),
          ),
        );
        setConnectModalVisible(false);
      } catch (err) {
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
    setSending(true);
    try {
      const signature = await sendSol(sendRecipient.trim(), amount, {
        fromAddress: activeWallet.address,
      });
      await refreshBalance(activeWallet.address).catch((err) =>
        console.warn("Balance refresh failed after send", err),
      );
      setSendModalVisible(false);
      setSendRecipient("");
      setSendAmount("");
      Alert.alert("Sent", `Transaction signature:\n${signature}`);
    } catch (err) {
      console.warn("Send failed", err);
      Alert.alert("Send failed", "Please check details and try again.");
    } finally {
      setSending(false);
    }
  }, [activeWallet, refreshBalance, sendAmount, sendRecipient, sendSol]);

  const handleReceive = useCallback(() => {
    if (!activeWallet) {
      Alert.alert("No wallet", "Connect a wallet to receive.");
      return;
    }
    Alert.alert("Receive", `Your address:\n${activeWallet.address}`);
  }, [activeWallet]);

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
    return availableWallets.map((wallet) => (
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
      {/* Balance Section */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceValue}>{formatUsd(totalBalanceUsd)}</Text>
        <Text style={styles.balanceSol}>{totalBalanceSol.toFixed(4)} SOL</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setSendModalVisible(true)}
        >
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleReceive}>
          <Text style={styles.actionIcon}>📥</Text>
          <Text style={styles.actionText}>Receive</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleStub("Swap")}
        >
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionText}>Swap</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleStub("Stake")}
        >
          <Text style={styles.actionIcon}>📊</Text>
          <Text style={styles.actionText}>Stake</Text>
        </TouchableOpacity>
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
          linkedWallets.map((wallet) => {
            const isActiveWallet = activeWallet?.address === wallet.address;
            const walletBalanceLamports = balances[wallet.address] ?? 0;
            const walletBalanceSol = walletBalanceLamports / LAMPORTS_PER_SOL;
            const walletBalanceUsd = walletBalanceSol * 100; // Mock USD value

            return (
              <View key={wallet.address} style={styles.walletCard}>
                <View style={styles.walletHeader}>
                  <View>
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
                      onPress={() => handleSelectWallet(wallet.address)}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1221",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  balanceSection: {
    marginBottom: 32,
  },
  balanceLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  balanceSol: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  walletsSection: {
    marginBottom: 24,
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
    backgroundColor: "#7F56D9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  walletCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
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
    backgroundColor: "rgba(127, 86, 217, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127, 86, 217, 0.4)",
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
    color: "#7F56D9",
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
    backgroundColor: "#0B1221",
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalClose: {
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#7F56D9",
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
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: 12,
    color: "#FFFFFF",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: "#7F56D9",
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
});

export default WalletScreen;
