import React, { useState, useEffect, useCallback } from "react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme/ThemeContext";
import { useSolana } from "../../context/SolanaContext";
import { useWalletStore, useWalletBalanceStore } from "../../store/walletStore";
import { toast } from "../common/ErrorToast";
import { NETWORK_FEES, UI_CONFIG } from "../../config/appConfig";
import { decodeWalletAddress, validateSolAmount } from "../../utils";

interface SendModalProps {
  visible: boolean;
  onClose: () => void;
}

const SendModal: React.FC<SendModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendSol, refreshBalance, connection } = useSolana();
  const { activeWallet, primaryWalletAddress } = useWalletStore();
  const { detailedBalances } = useWalletBalanceStore();

  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);

  // Update fee estimate using real RPC fee calculation
  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      setEstimatedFee(null);
      return;
    }

    const amount = parseFloat(sendAmount);
    const rawRecipient = sendRecipient.trim();
    if (!activeWallet || !rawRecipient || Number.isNaN(amount) || amount <= 0) {
      setEstimatedFee(null);
      return;
    }

    let recipient: string;
    try {
      recipient = decodeWalletAddress(rawRecipient);
    } catch {
      setEstimatedFee(null);
      return;
    }

    if (recipient === activeWallet.address) {
      setEstimatedFee(null);
      return;
    }

    const estimateFee = async () => {
      try {
        const fromPubkey = new PublicKey(activeWallet.address);
        const toPubkey = new PublicKey(recipient);
        const lamports = Math.round(amount * LAMPORTS_PER_SOL);

        const latestBlockhash = await connection.getLatestBlockhash();
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          }),
        );
        transaction.feePayer = fromPubkey;
        transaction.recentBlockhash = latestBlockhash.blockhash;

        const message = transaction.compileMessage();
        const feeResponse = await connection.getFeeForMessage(
          message,
          "confirmed",
        );
        const feeLamports = feeResponse.value;
        const feeSol =
          typeof feeLamports === "number"
            ? feeLamports / LAMPORTS_PER_SOL
            : NETWORK_FEES.SOLANA;

        if (!cancelled) {
          setEstimatedFee(feeSol);
        }
      } catch (error) {
        console.warn("Failed to estimate network fee", error);
        if (!cancelled) {
          setEstimatedFee(NETWORK_FEES.SOLANA);
        }
      }
    };

    estimateFee();

    return () => {
      cancelled = true;
    };
  }, [activeWallet, connection, sendAmount, sendRecipient, visible]);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setSendRecipient("");
      setSendAmount("");
      setSending(false);
      setEstimatedFee(null);
    }
  }, [visible]);

  const ensureSendingReady = useCallback(() => {
    const isPrimaryWalletSet = Boolean(primaryWalletAddress);
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
  }, [activeWallet, primaryWalletAddress]);

  // Use max amount for sending
  const handleUseMaxAmount = useCallback(() => {
    if (!activeWallet) {
      return;
    }
    const balance = detailedBalances[activeWallet.address]?.balance || 0;
    const feeReserve = estimatedFee || NETWORK_FEES.SOLANA;
    const maxSendable = Math.max(0, balance - feeReserve);
    setSendAmount(maxSendable.toFixed(6));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet, detailedBalances, estimatedFee]);

  // Handle send transaction
  const handleSend = useCallback(async () => {
    if (!ensureSendingReady()) {
      return;
    }
    if (!activeWallet) {
      Alert.alert("Select wallet", "Please choose a wallet first.");
      return;
    }

    const rawRecipient = sendRecipient.trim();
    const balance = detailedBalances[activeWallet.address]?.balance || 0;

    let trimmedRecipient: string;
    try {
      trimmedRecipient = decodeWalletAddress(rawRecipient);
    } catch {
      Alert.alert("Invalid address", "Invalid recipient address format");
      return;
    }

    // Prevent self-transfer
    if (trimmedRecipient === activeWallet.address) {
      Alert.alert("Self-transfer", "Cannot send to the same wallet address.");
      return;
    }

    // Validate amount
    const amountValidation = validateSolAmount(sendAmount, balance);
    if (!amountValidation.valid) {
      Alert.alert("Invalid amount", amountValidation.error || "Invalid amount");
      return;
    }

    const amount = parseFloat(sendAmount);

    const effectiveFee = estimatedFee ?? NETWORK_FEES.SOLANA;
    const totalCost = amount + effectiveFee;
    if (totalCost > balance) {
      Alert.alert(
        "Insufficient balance",
        `Required: ${totalCost.toFixed(6)} SOL (including network fee).`,
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

      // Close modal
      onClose();

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
    ensureSendingReady,
    estimatedFee,
    onClose,
    refreshBalance,
    sendAmount,
    sendRecipient,
    sendSol,
    detailedBalances,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
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
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalScroll}>
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
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Amount (SOL)
                </Text>
                <TouchableOpacity onPress={handleUseMaxAmount}>
                  <Text
                    style={[styles.maxButton, { color: theme.colors.primary }]}
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
                <Text style={[styles.feeAmount, { color: theme.colors.text }]}>
                  {estimatedFee.toFixed(6)} SOL
                </Text>
              </View>
            )}
          </View>

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
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: UI_CONFIG.BORDER_RADIUS.XL,
    borderTopRightRadius: UI_CONFIG.BORDER_RADIUS.XL,
    minHeight: "70%",
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: UI_CONFIG.SPACING.MD,
    paddingVertical: UI_CONFIG.SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalScroll: {
    flex: 1,
    paddingHorizontal: UI_CONFIG.SPACING.MD,
    paddingVertical: UI_CONFIG.SPACING.MD,
  },
  inputGroup: {
    marginBottom: UI_CONFIG.SPACING.MD,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: UI_CONFIG.SPACING.SM,
  },
  textInput: {
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    borderWidth: 1,
    paddingHorizontal: UI_CONFIG.SPACING.SM,
    paddingVertical: UI_CONFIG.SPACING.SM,
    fontSize: 14,
    fontWeight: "500",
  },
  amountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: UI_CONFIG.SPACING.SM,
  },
  maxButton: {
    fontSize: 12,
    fontWeight: "600",
  },
  feeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: UI_CONFIG.SPACING.SM,
    paddingVertical: UI_CONFIG.SPACING.SM,
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    marginBottom: UI_CONFIG.SPACING.MD,
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
    gap: UI_CONFIG.SPACING.SM,
    paddingVertical: 14,
    borderRadius: UI_CONFIG.BORDER_RADIUS.MD,
    marginHorizontal: UI_CONFIG.SPACING.MD,
    marginVertical: UI_CONFIG.SPACING.MD,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default SendModal;
