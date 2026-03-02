import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../theme/ThemeContext";
import { toast } from "../common/ErrorToast";
import { decodeWalletAddress } from "../../utils";

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  walletAddress?: string;
}

const ReceiveModal: React.FC<ReceiveModalProps> = ({
  visible,
  onClose,
  walletAddress,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const normalizedWalletAddress = useMemo(() => {
    if (!walletAddress) {
      return null;
    }

    try {
      return decodeWalletAddress(walletAddress);
    } catch (error) {
      console.warn("Invalid wallet address for receive modal", error);
      return null;
    }
  }, [walletAddress]);

  // Copy wallet address
  const handleCopyAddress = useCallback(async () => {
    if (!normalizedWalletAddress) {
      return;
    }
    try {
      await Clipboard.setStringAsync(normalizedWalletAddress);
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
  }, [normalizedWalletAddress]);

  // Share wallet address
  const handleShareAddress = useCallback(async () => {
    if (!normalizedWalletAddress) {
      return;
    }
    try {
      await Share.share({
        message: `Send SOL to ${normalizedWalletAddress}`,
      });
    } catch (err) {
      console.warn("Share failed", err);
      toast.show({
        message: "Failed to share address. Try again.",
        type: "error",
      });
    }
  }, [normalizedWalletAddress]);

  if (!normalizedWalletAddress) {
    return null;
  }

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
              Receive SOL
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.receiveContent}>
            {/* QR Code */}
            <View
              style={[
                styles.qrContainer,
                { backgroundColor: theme.colors.background },
              ]}
            >
              <QRCode
                value={normalizedWalletAddress}
                size={200}
                backgroundColor="#FFFFFF"
                color="#050814"
              />
            </View>

            {/* Wallet Address Display */}
            <View style={styles.addressContainer}>
              <Text
                style={[styles.addressLabel, { color: theme.colors.onSurface }]}
              >
                Wallet Address
              </Text>
              <Text style={[styles.addressText, { color: theme.colors.text }]}>
                {normalizedWalletAddress}
              </Text>
            </View>
          </View>

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
  );
};

const styles = StyleSheet.create({
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
  receiveContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 100,
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

export default ReceiveModal;
