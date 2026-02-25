import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import { useSolana } from "../../context/SolanaContext";
import { LinkedWallet } from "../../types/wallet";
import { useWalletStore } from "../../store/walletStore";
import * as Haptics from "expo-haptics";
import { toast } from "../common/ErrorToast";
import { formatAddress, formatAmount } from "../../utils";
import { requireBiometricApproval } from "../../security/biometrics";

interface WalletWidgetProps {
  onSendPress?: () => void;
  onReceivePress?: () => void;
}

const WalletWidget: React.FC<WalletWidgetProps> = ({
  onSendPress,
  onReceivePress,
}) => {
  const { theme } = useTheme();
  const {
    linkedWallets,
    activeWallet,
    setActiveWallet,
    removeWallet,
    primaryWalletAddress,
    setPrimaryWalletAddress,
  } = useWalletStore();

  const {
    startAuthorization,
    finalizeAuthorization,
    refreshBalance,
    detailedBalances,
  } = useSolana();

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [walletSelectModalVisible, setWalletSelectModalVisible] =
    useState(false);
  const [connecting, setConnecting] = useState(false);

  const activeWalletBalance = activeWallet
    ? detailedBalances[activeWallet.address]?.balance || 0
    : 0;

  const activeWalletUsdValue = activeWallet
    ? detailedBalances[activeWallet.address]?.usdValue || 0
    : 0;

  const isPrimaryWalletSet = Boolean(primaryWalletAddress);
  const isActivePrimary =
    !!activeWallet && activeWallet.address === primaryWalletAddress;

  const accountStatusText = useMemo(() => {
    if (!isPrimaryWalletSet) {
      return "Select primary wallet to enable sending";
    }
    if (isActivePrimary) {
      return "Primary wallet • Full access";
    }
    return "Connected • Not primary";
  }, [isActivePrimary, isPrimaryWalletSet]);

  const handleStartConnect = useCallback(async () => {
    try {
      setConnecting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const preview = await startAuthorization();
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
    } finally {
      setConnecting(false);
    }
  }, [finalizeAuthorization, refreshBalance, startAuthorization]);

  const handleSelectLinkedWallet = useCallback(
    (wallet: LinkedWallet) => {
      setActiveWallet(wallet);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setWalletSelectModalVisible(false);
    },
    [setActiveWallet],
  );

  const handleRemoveLinkedWallet = useCallback(
    async (wallet: LinkedWallet) => {
      try {
        await requireBiometricApproval("Authenticate to remove this wallet");

        Alert.alert(
          "Remove wallet",
          `Are you sure you want to remove ${wallet.label || formatAddress(wallet.address)}?`,
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
                toast.show({
                  message: "Wallet removed",
                  type: "success",
                });
              },
            },
          ],
        );
      } catch (error) {
        console.error(
          "Biometric authentication failed for removing wallet:",
          error,
        );
        toast.show({
          message: "Authentication required to remove wallets",
          type: "error",
        });
      }
    },
    [removeWallet],
  );

  const handleSetPrimaryWallet = useCallback(async () => {
    if (!activeWallet) {
      Alert.alert("No Connected Wallet", "Please connect a wallet first.");
      return;
    }
    try {
      await requireBiometricApproval("Authenticate to set primary wallet", {
        allowSessionReuse: true,
      });
      setPrimaryWalletAddress(activeWallet.address);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({ message: "Primary wallet set", type: "success" });
    } catch (error) {
      console.error("Failed to set primary wallet due to biometrics:", error);
      toast.show({
        message: "Authentication required to set primary wallet",
        type: "error",
      });
    }
  }, [activeWallet, setPrimaryWalletAddress]);

  const handleCycleWallet = useCallback(() => {
    if (linkedWallets.length === 0) {
      setConnectModalVisible(true);
      return;
    }

    if (!activeWallet) {
      setActiveWallet(linkedWallets[0]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    const currentIndex = linkedWallets.findIndex(
      (wallet: any) => wallet.address === activeWallet.address,
    );
    const nextWallet =
      linkedWallets[
        (currentIndex + 1 + linkedWallets.length) % linkedWallets.length
      ];
    setActiveWallet(nextWallet);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet, linkedWallets, setActiveWallet]);

  if (!activeWallet) {
    return (
      <TouchableOpacity
        style={[styles.connectButton, { borderColor: theme.colors.primary }]}
        onPress={() => setConnectModalVisible(true)}
      >
        <Feather name="plus" size={20} color={theme.colors.primary} />
        <Text
          style={[styles.connectButtonText, { color: theme.colors.primary }]}
        >
          Connect Wallet
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <View
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        {/* Wallet Info Header */}
        <TouchableOpacity
          style={styles.walletHeader}
          onPress={() => setWalletSelectModalVisible(true)}
        >
          <View style={styles.walletInfo}>
            <Text style={[styles.walletLabel, { color: theme.colors.text }]}>
              {activeWallet.label || formatAddress(activeWallet.address)}
            </Text>
            <Text
              style={[styles.statusText, { color: theme.colors.onSurface }]}
            >
              {accountStatusText}
            </Text>
          </View>
          <Feather
            name="chevron-down"
            size={20}
            color={theme.colors.onSurface}
          />
        </TouchableOpacity>

        {/* Balance Display */}
        <View style={styles.balanceContainer}>
          <Text
            style={[styles.balanceLabel, { color: theme.colors.onSurface }]}
          >
            Available Balance
          </Text>
          <Text style={[styles.balanceAmount, { color: theme.colors.text }]}>
            {formatAmount(activeWalletBalance)} SOL
          </Text>
          <Text style={[styles.balanceUsd, { color: theme.colors.onSurface }]}>
            ${activeWalletUsdValue.toFixed(2)}
          </Text>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={onSendPress}
            disabled={!isActivePrimary}
          >
            <Feather name="send" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.secondary }]}
            onPress={onReceivePress}
          >
            <Feather name="arrow-down" size={18} color="#050814" />
            <Text style={[styles.buttonText, { color: "#050814" }]}>
              Receive
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
            onPress={handleCycleWallet}
          >
            <Feather name="refresh-cw" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Wallet Selection Modal */}
      <Modal
        visible={walletSelectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWalletSelectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select Wallet
              </Text>
              <TouchableOpacity
                onPress={() => setWalletSelectModalVisible(false)}
              >
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.walletList}>
              {linkedWallets.map((wallet: LinkedWallet) => (
                <View key={wallet.address}>
                  <TouchableOpacity
                    style={[
                      styles.walletOption,
                      {
                        backgroundColor:
                          activeWallet.address === wallet.address
                            ? theme.colors.primary + "20"
                            : "transparent",
                        borderColor: theme.colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => handleSelectLinkedWallet(wallet)}
                  >
                    <View style={styles.walletOptionInfo}>
                      <Text
                        style={[
                          styles.walletOptionLabel,
                          { color: theme.colors.text },
                        ]}
                      >
                        {wallet.label || formatAddress(wallet.address)}
                      </Text>
                      <Text
                        style={[
                          styles.walletOptionAddress,
                          { color: theme.colors.onSurface },
                        ]}
                      >
                        {formatAddress(wallet.address)}
                      </Text>
                      {wallet.address === primaryWalletAddress && (
                        <View
                          style={[
                            styles.primaryBadge,
                            { backgroundColor: theme.colors.primary + "30" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.primaryBadgeText,
                              { color: theme.colors.primary },
                            ]}
                          >
                            Primary
                          </Text>
                        </View>
                      )}
                    </View>
                    {activeWallet.address === wallet.address && (
                      <Feather
                        name="check"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.walletActions,
                      { borderColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    {wallet.address !== primaryWalletAddress && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={handleSetPrimaryWallet}
                      >
                        <Feather
                          name="star"
                          size={16}
                          color={theme.colors.onSurface}
                        />
                        <Text
                          style={[
                            styles.actionButtonText,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          Set Primary
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleRemoveLinkedWallet(wallet)}
                    >
                      <Feather name="trash-2" size={16} color="#FF8BA7" />
                      <Text
                        style={[styles.actionButtonText, { color: "#FF8BA7" }]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.addWalletButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => {
                setWalletSelectModalVisible(false);
                setConnectModalVisible(true);
              }}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addWalletButtonText}>Add Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Connect Modal */}
      <Modal
        visible={connectModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setConnectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.connectModalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {connecting ? (
              <>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  style={[styles.connectingText, { color: theme.colors.text }]}
                >
                  Opening wallet...
                </Text>
              </>
            ) : (
              <>
                <Feather
                  name="key"
                  size={48}
                  color={theme.colors.primary}
                  style={styles.connectIcon}
                />
                <Text
                  style={[styles.connectTitle, { color: theme.colors.text }]}
                >
                  Connect Your Wallet
                </Text>
                <Text
                  style={[
                    styles.connectDescription,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Select a wallet app to authorize your account
                </Text>

                <TouchableOpacity
                  style={[
                    styles.connectActionButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleStartConnect}
                >
                  <Text style={styles.connectActionButtonText}>
                    Connect Wallet
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setConnectModalVisible(false)}>
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 2,
    gap: 8,
    marginBottom: 16,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  walletHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  balanceContainer: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: 14,
    fontWeight: "500",
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingTop: 16,
  },
  connectModalContent: {
    borderRadius: 24,
    margin: 32,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  walletList: {
    paddingHorizontal: 16,
  },
  walletOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  walletOptionInfo: {
    flex: 1,
  },
  walletOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  walletOptionAddress: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  primaryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  walletActions: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    flex: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  addWalletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addWalletButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  connectIcon: {
    marginBottom: 16,
  },
  connectTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  connectDescription: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 24,
  },
  connectingText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  connectActionButton: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  connectActionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
  },
});

export default WalletWidget;
