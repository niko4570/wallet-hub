import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  Share,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import { useSolana } from "../context/SolanaContext";
import { useWalletStore } from "../store/walletStore";
import PortfolioHeader from "../components/common/PortfolioHeader";
import ModernPortfolioLineChart from "../components/analytics/ModernPortfolioLineChart";
import { AssetAllocationPieChart } from "../components/analytics/AssetAllocationPieChart";
import WalletWidget from "../components/wallet/WalletWidget";
import { toast } from "../components/common/ErrorToast";
import { formatAddress, formatAmount } from "../utils/format";
import { decodeWalletAddress } from "../utils/solanaAddress";
import * as Haptics from "expo-haptics";
import { useWalletHistoricalStore } from "../store/walletStore";

// Helper function to filter historical data by time range
const filterHistoricalDataByRange = (
  data: Array<{ timestamp: number; usd: number; sol: number }>,
  days: number,
): Array<{ timestamp: number; totalValueUSD: number }> => {
  const now = Date.now();
  const startTime = now - days * 24 * 60 * 60 * 1000;
  return data
    .filter((entry) => entry.timestamp >= startTime)
    .map((entry) => ({
      timestamp: entry.timestamp,
      totalValueUSD: entry.usd,
    }));
};

// Helper function to validate Solana address
const isValidSolanaAddress = (address: string): boolean => {
  try {
    decodeWalletAddress(address);
    return true;
  } catch (error) {
    return false;
  }
};

// Helper function to get top tokens from detailed balances
const getTopTokens = (
  detailedData: Record<
    string,
    {
      tokens?: Array<{
        symbol?: string;
        mint: string;
        usdValue: number;
      }>;
    }
  >,
  walletAddress?: string,
): Array<{ symbol: string; valueUSD: number }> => {
  if (!walletAddress || !detailedData[walletAddress]?.tokens) {
    return [];
  }

  return detailedData[walletAddress].tokens
    .map((token) => ({
      symbol: token.symbol || token.mint.slice(0, 6),
      valueUSD: token.usdValue,
    }))
    .sort((a, b) => b.valueUSD - a.valueUSD)
    .slice(0, 5);
};

const PortfolioScreen: React.FC = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendSol, refreshBalance, detailedBalances } = useSolana();
  const { linkedWallets, activeWallet, primaryWalletAddress } =
    useWalletStore();
  const getHistoricalBalances = useWalletHistoricalStore(
    (state) => state.getHistoricalBalances,
  );

  // Portfolio state
  const [timeRange, setTimeRange] = useState<"1D" | "7D" | "30D">("7D");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize chart data from real historical data
  const initialHistoryData = activeWallet
    ? getHistoricalBalances(activeWallet.address)
    : [];
  const [chartData, setChartData] = useState(
    filterHistoricalDataByRange(initialHistoryData, 7),
  );

  // Send modal state
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);

  // Receive modal state
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);

  // Animated values
  const chartOpacity = useSharedValue(1);

  // Balance data
  const activeWalletBalance = activeWallet
    ? detailedBalances[activeWallet.address]?.balance || 0
    : 0;

  const activeWalletUsdValue = activeWallet
    ? detailedBalances[activeWallet.address]?.usdValue || 0
    : 0;

  const isPrimaryWalletSet = Boolean(primaryWalletAddress);
  const isActivePrimary =
    !!activeWallet && activeWallet.address === primaryWalletAddress;

  // Update fee estimate when inputs change
  useEffect(() => {
    if (!sendModalVisible) {
      setEstimatedFee(null);
      return;
    }

    const amount = parseFloat(sendAmount);
    if (!sendRecipient.trim() || Number.isNaN(amount) || amount <= 0) {
      setEstimatedFee(null);
      return;
    }

    setEstimatedFee(0.000005);
  }, [sendModalVisible, sendRecipient, sendAmount]);

  // Update chart data when active wallet changes
  useEffect(() => {
    if (activeWallet) {
      const historyData = getHistoricalBalances(activeWallet.address);
      const days = parseInt(timeRange);
      setChartData(filterHistoricalDataByRange(historyData, days));
    }
  }, [activeWallet, timeRange, getHistoricalBalances]);

  // Handle time range change with animation
  const handleTimeRangeChange = (range: "1D" | "7D" | "30D") => {
    setTimeRange(range);
    setLoading(true);

    const updateChartData = () => {
      if (activeWallet) {
        const historyData = getHistoricalBalances(activeWallet.address);
        const days = parseInt(range);
        setChartData(filterHistoricalDataByRange(historyData, days));
      }
      setLoading(false);
      chartOpacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.inOut(Easing.ease),
      });
    };

    chartOpacity.value = withTiming(
      0,
      {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      },
      () => {
        setTimeout(() => {
          runOnJS(updateChartData)();
        }, 500);
      },
    );
  };

  // Handle screen refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshPromises = linkedWallets.map((wallet: any) =>
        refreshBalance(wallet.address).catch((err: any) => {
          console.warn(`Balance refresh failed for ${wallet.address}`, err);
        }),
      );

      await Promise.all(refreshPromises);
    } catch (err: any) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, refreshBalance]);

  // Validate sending is allowed
  // Validate Solana address format
  const isValidSolanaAddress = useCallback((address: string): boolean => {
    if (!address || address.length < 32 || address.length > 44) {
      return false;
    }
    // Check if address contains only valid base58 characters
    const base58Regex = /^[1-9A-HJ-NP-Z]+$/;
    return base58Regex.test(address);
  }, []);

  const ensureSendingReady = useCallback(() => {
    if (!isPrimaryWalletSet) {
      Alert.alert(
        "Set Primary Wallet",
        "Please select a primary wallet to send.",
      );
      return false;
    }
    if (!activeWallet || activeWallet.address !== primaryWalletAddress) {
      Alert.alert(
        "Switch to Primary Wallet",
        "Please switch to the primary wallet before sending.",
      );
      return false;
    }
    return true;
  }, [activeWallet, isPrimaryWalletSet, primaryWalletAddress]);

  // Handle send transaction
  const handleSend = useCallback(async () => {
    if (!ensureSendingReady()) {
      return;
    }
    if (!activeWallet) {
      Alert.alert("Select wallet", "Please choose a wallet first.");
      return;
    }

    const trimmedRecipient = sendRecipient.trim();
    const amount = parseFloat(sendAmount);

    // Validate recipient address
    if (!trimmedRecipient) {
      Alert.alert("Missing recipient", "Please enter a recipient address.");
      return;
    }

    if (!isValidSolanaAddress(trimmedRecipient)) {
      Alert.alert("Invalid address", "Please enter a valid Solana address.");
      return;
    }

    // Prevent self-transfer
    if (trimmedRecipient === activeWallet.address) {
      Alert.alert("Self-transfer", "Cannot send to the same wallet address.");
      return;
    }

    // Validate amount
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Please enter an amount greater than 0.");
      return;
    }

    const fee = estimatedFee || 0.000005;
    const totalCost = amount + fee;

    if (totalCost > activeWalletBalance) {
      Alert.alert(
        "Insufficient balance",
        `You need ${totalCost.toFixed(6)} SOL (including ${fee.toFixed(6)} SOL fee).\nAvailable: ${activeWalletBalance.toFixed(6)} SOL.`,
      );
      return;
    }

    setSending(true);
    try {
      await sendSol(trimmedRecipient, amount, {
        fromAddress: activeWallet.address,
      });

      // Refresh balance after successful send
      await refreshBalance(activeWallet.address).catch((err: any) => {
        console.warn("Balance refresh failed after send", err);
      });

      // Reset and close modal
      setSendModalVisible(false);
      setSendRecipient("");
      setSendAmount("");

      // Show success feedback
      toast.show({
        message: `Sent ${amount} SOL successfully!`,
        type: "success",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.warn("Send failed:", err);
      const errorMessage =
        err?.message ||
        "Failed to send transaction. Please check details and try again.";
      toast.show({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setSending(false);
    }
  }, [
    activeWallet,
    activeWalletBalance,
    ensureSendingReady,
    estimatedFee,
    isValidSolanaAddress,
    refreshBalance,
    sendAmount,
    sendRecipient,
    sendSol,
  ]);

  // Handle receiving (show QR code and address)
  const handleReceive = useCallback(() => {
    if (!activeWallet) {
      Alert.alert(
        "No wallet connected",
        "Please connect a wallet first to receive SOL.",
      );
      return;
    }
    setReceiveModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet]);

  // Copy wallet address
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

  // Share wallet address
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

  // Use max amount for sending
  const handleUseMaxAmount = useCallback(() => {
    if (!activeWallet) {
      return;
    }
    const feeReserve = estimatedFee || 0.000005;
    const maxSendable = Math.max(0, activeWalletBalance - feeReserve);
    setSendAmount(maxSendable.toFixed(6));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet, activeWalletBalance, estimatedFee]);

  // Animated chart style
  const chartAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: chartOpacity.value,
      transform: [
        {
          scale: withSpring(chartOpacity.value, {
            damping: 10,
            stiffness: 100,
          }),
        },
      ],
    };
  });

  // Get time range button style
  const getTimeRangeButtonStyle = (range: "1D" | "7D" | "30D") => {
    return useAnimatedStyle(() => {
      if (timeRange === range) {
        return {
          transform: [
            {
              scale: withSpring(1.05, {
                damping: 10,
                stiffness: 100,
              }),
            },
          ],
        };
      }
      return {};
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Wallet Widget */}
        <WalletWidget
          onSendPress={() => setSendModalVisible(true)}
          onReceivePress={handleReceive}
        />

        {/* Portfolio Header */}
        <View style={styles.section}>
          <PortfolioHeader
            totalValueUSD={activeWalletUsdValue}
            change24hPercent={2.5}
          />
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <Animated.View style={getTimeRangeButtonStyle("1D")}>
            <TouchableOpacity
              style={[
                styles.timeRangeButtonInner,
                timeRange === "1D" && {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => handleTimeRangeChange("1D")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  timeRange === "1D" && { color: "#FFFFFF" },
                ]}
              >
                1D
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getTimeRangeButtonStyle("7D")}>
            <TouchableOpacity
              style={[
                styles.timeRangeButtonInner,
                timeRange === "7D" && {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => handleTimeRangeChange("7D")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  timeRange === "7D" && { color: "#FFFFFF" },
                ]}
              >
                7D
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={getTimeRangeButtonStyle("30D")}>
            <TouchableOpacity
              style={[
                styles.timeRangeButtonInner,
                timeRange === "30D" && {
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => handleTimeRangeChange("30D")}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  timeRange === "30D" && { color: "#FFFFFF" },
                ]}
              >
                30D
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Portfolio Line Chart */}
        <View style={styles.section}>
          <Animated.View style={chartAnimatedStyle}>
            {loading ? (
              <View
                style={[
                  styles.loadingContainer,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : (
              <ModernPortfolioLineChart history={chartData} />
            )}
          </Animated.View>
        </View>

        {/* Asset Allocation Pie Chart */}
        <View style={styles.section}>
          <AssetAllocationPieChart
            tokens={getTopTokens(detailedBalances, activeWallet?.address)}
          />
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Send Modal */}
      <Modal
        visible={sendModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSendModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Send SOL
              </Text>
              <TouchableOpacity onPress={() => setSendModalVisible(false)}>
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Recipient Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Recipient Address
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.surfaceVariant,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="SOL address"
                  placeholderTextColor={theme.colors.disabled}
                  value={sendRecipient}
                  onChangeText={setSendRecipient}
                  editable={!sending}
                />
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <View style={styles.amountHeader}>
                  <Text
                    style={[styles.inputLabel, { color: theme.colors.text }]}
                  >
                    Amount (SOL)
                  </Text>
                  <TouchableOpacity onPress={handleUseMaxAmount}>
                    <Text
                      style={[
                        styles.maxButton,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Max
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.surfaceVariant,
                      color: theme.colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.disabled}
                  value={sendAmount}
                  onChangeText={setSendAmount}
                  keyboardType="decimal-pad"
                  editable={!sending}
                />
              </View>

              {/* Fee Display */}
              {estimatedFee && (
                <View
                  style={[
                    styles.feeContainer,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <Text
                    style={[styles.feeLabel, { color: theme.colors.onSurface }]}
                  >
                    Network Fee
                  </Text>
                  <Text
                    style={[styles.feeAmount, { color: theme.colors.text }]}
                  >
                    {estimatedFee.toFixed(6)} SOL
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: sending ? 0.7 : 1,
                  marginBottom: Math.max(insets.bottom, 16),
                },
              ]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Transaction</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Receive Modal */}
      <Modal
        visible={receiveModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReceiveModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Receive SOL
              </Text>
              <TouchableOpacity onPress={() => setReceiveModalVisible(false)}>
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.receiveContent}
            >
              {activeWallet && (
                <>
                  {/* QR Code */}
                  <View
                    style={[
                      styles.qrContainer,
                      { backgroundColor: theme.colors.background },
                    ]}
                  >
                    <QRCode
                      value={activeWallet.address}
                      size={200}
                      backgroundColor="#FFFFFF"
                      color="#050814"
                    />
                  </View>

                  {/* Wallet Address Display */}
                  <View style={styles.addressContainer}>
                    <Text
                      style={[
                        styles.addressLabel,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      Wallet Address
                    </Text>
                    <Text
                      style={[styles.addressText, { color: theme.colors.text }]}
                    >
                      {activeWallet.address}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View
              style={[
                styles.receiveActions,
                { paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.primary,
                    flex: 1,
                  },
                ]}
                onPress={handleCopyAddress}
              >
                <Feather name="copy" size={18} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.colors.secondary,
                    flex: 1,
                  },
                ]}
                onPress={handleShareAddress}
              >
                <Feather name="share-2" size={18} color="#050814" />
                <Text style={[styles.actionButtonText, { color: "#050814" }]}>
                  Share
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  timeRangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 28,
    gap: 16,
  },
  timeRangeButtonInner: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeRangeButtonText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    height: 240,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  bottomSpace: {
    height: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "70%",
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Add extra padding to ensure content is visible above the button
  },
  receiveContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100, // Add extra padding to ensure content is visible above the buttons
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  amountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 12,
    fontWeight: "600",
  },
  feeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  feeLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  feeAmount: {
    fontSize: 12,
    fontWeight: "600",
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 16,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  qrContainer: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addressContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  addressText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  receiveActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default PortfolioScreen;
