import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMultiWalletManager } from "../../hooks/useMultiWalletManager";
import { useTheme } from "../../theme/ThemeContext";
import { formatAddress } from "../../utils";
import * as Haptics from "expo-haptics";

interface MultiWalletManagerProps {
  onWalletSelect?: (sessionId: string) => void;
  children?: React.ReactNode;
}

/**
 * Multi-wallet manager component.
 * Provides a complete UI for managing multiple wallet connections.
 *
 * Features:
 * - Add multiple wallets (Phantom, Solflare, Backpack, etc.)
 * - Switch between wallets
 * - Remove wallets
 * - Edit wallet labels
 * - View all connected wallets
 *
 * @example
 * ```typescript
 * function App() {
 *   return (
 *     <MultiWalletManager
 *       onWalletSelect={(sessionId) => {
 *         console.log("Selected wallet:", sessionId);
 *       }}
 *     >
 *       {/* Your app content *}/}
 *     </MultiWalletManager>
 *   );
 * }
 * ```
 */
export const MultiWalletManager: React.FC<MultiWalletManagerProps> = ({
  onWalletSelect,
  children,
}) => {
  const { theme } = useTheme();
  const {
    sessions,
    activeSession,
    isLoading,
    error,
    addWallet,
    removeWallet,
    setActiveWallet,
    disconnectAll,
    updateWalletLabel,
    hasWallets,
    walletCount,
  } = useMultiWalletManager();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const handleAddWallet = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // MWA will automatically show the wallet selector
      const result = await addWallet({
        label: `Wallet ${walletCount + 1}`,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onWalletSelect?.(result.sessionId);
      setModalVisible(false);
    } catch (err: any) {
      console.error("[MultiWalletManager] Add wallet failed:", err);
      Alert.alert("Error", err.message);
    }
  }, [addWallet, walletCount, onWalletSelect]);

  const handleSelectWallet = useCallback(
    (sessionId: string) => {
      setActiveWallet(sessionId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onWalletSelect?.(sessionId);
      setModalVisible(false);
    },
    [setActiveWallet, onWalletSelect],
  );

  const handleRemoveWallet = useCallback(
    (sessionId: string, label: string) => {
      Alert.alert(
        "Remove Wallet",
        `Are you sure you want to remove ${label}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeWallet(sessionId);
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning,
                );
              } catch (err: any) {
                Alert.alert("Error", err.message);
              }
            },
          },
        ],
      );
    },
    [removeWallet],
  );

  const handleEditLabel = useCallback(
    (sessionId: string, currentLabel: string) => {
      setEditingSession(sessionId);
      setEditLabel(currentLabel);
    },
    [],
  );

  const handleSaveLabel = useCallback(async () => {
    if (editingSession && editLabel.trim()) {
      try {
        updateWalletLabel(editingSession, editLabel.trim());
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (err: any) {
        Alert.alert("Error", "Failed to update label");
      }
    }
    setEditingSession(null);
    setEditLabel("");
  }, [editingSession, editLabel, updateWalletLabel]);

  const handleDisconnectAll = useCallback(() => {
    Alert.alert(
      "Disconnect All Wallets",
      `Are you sure you want to disconnect all ${walletCount} wallets?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect All",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectAll();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  }, [disconnectAll, walletCount]);

  const renderWalletItem = (session: (typeof sessions)[0], index: number) => {
    const isActive = activeSession?.sessionId === session.sessionId;
    const isEditing = editingSession === session.sessionId;

    return (
      <View key={session.sessionId}>
        <TouchableOpacity
          style={[
            styles.walletItem,
            {
              backgroundColor: isActive
                ? theme.colors.primary + "20"
                : "transparent",
              borderColor: theme.colors.surfaceVariant,
            },
          ]}
          onPress={() => handleSelectWallet(session.sessionId)}
          activeOpacity={0.7}
        >
          <View style={styles.walletItemLeft}>
            <View
              style={[
                styles.walletIcon,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Feather
                name={
                  session.label.toLowerCase().includes("phantom")
                    ? "hexagon"
                    : session.label.toLowerCase().includes("solflare")
                      ? "zap"
                      : "briefcase"
                }
                size={20}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.walletInfo}>
              {isEditing ? (
                <TextInput
                  style={[
                    styles.editInput,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                    },
                  ]}
                  value={editLabel}
                  onChangeText={setEditLabel}
                  autoFocus
                  onSubmitEditing={handleSaveLabel}
                  onBlur={handleSaveLabel}
                />
              ) : (
                <>
                  <Text
                    style={[styles.walletLabel, { color: theme.colors.text }]}
                    numberOfLines={1}
                  >
                    {session.label}
                  </Text>
                  <Text
                    style={[
                      styles.walletAddress,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {formatAddress(session.address)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.walletActions}>
            {isActive && (
              <View
                style={[
                  styles.activeBadge,
                  { backgroundColor: theme.colors.primary + "30" },
                ]}
              >
                <Text
                  style={[
                    styles.activeBadgeText,
                    { color: theme.colors.primary },
                  ]}
                >
                  Active
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleEditLabel(session.sessionId, session.label)}
            >
              <Feather name="edit-2" size={16} color={theme.colors.onSurface} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() =>
                handleRemoveWallet(session.sessionId, session.label)
              }
            >
              <Feather name="trash-2" size={16} color="#FF8BA7" />
            </TouchableOpacity>

            {!isActive && (
              <Feather
                name="check"
                size={20}
                color={theme.colors.primary}
                style={styles.checkIcon}
              />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.triggerButton,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.surfaceVariant,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        <Feather name="credit-card" size={20} color={theme.colors.text} />
        <Text style={[styles.triggerButtonText, { color: theme.colors.text }]}>
          {hasWallets
            ? `${walletCount} Wallet${walletCount > 1 ? "s" : ""}`
            : "Connect Wallet"}
        </Text>
        {hasWallets && (
          <Feather
            name="chevron-down"
            size={16}
            color={theme.colors.onSurface}
          />
        )}
      </TouchableOpacity>

      {/* Wallet Management Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Manage Wallets
              </Text>
              <View style={styles.headerActions}>
                {hasWallets && (
                  <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={handleDisconnectAll}
                  >
                    <Feather
                      name="power"
                      size={18}
                      color={theme.colors.onSurface}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.headerActionButton}
                >
                  <Feather name="x" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Display */}
            {error && (
              <View
                style={[
                  styles.errorContainer,
                  { backgroundColor: theme.colors.error + "20" },
                ]}
              >
                <Feather
                  name="alert-circle"
                  size={16}
                  color={theme.colors.error}
                />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Loading State */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  style={[
                    styles.loadingText,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Processing...
                </Text>
              </View>
            )}

            {/* Wallet List */}
            <ScrollView style={styles.walletList}>
              {sessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather
                    name="credit-card"
                    size={48}
                    color={theme.colors.onSurface}
                  />
                  <Text
                    style={[
                      styles.emptyStateTitle,
                      { color: theme.colors.text },
                    ]}
                  >
                    No Wallets Connected
                  </Text>
                  <Text
                    style={[
                      styles.emptyStateText,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    Connect your first wallet to get started
                  </Text>
                </View>
              ) : (
                sessions.map((session, index) =>
                  renderWalletItem(session, index),
                )
              )}
            </ScrollView>

            {/* Add Wallet Button */}
            <TouchableOpacity
              style={[
                styles.addWalletButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleAddWallet}
              disabled={isLoading}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addWalletButtonText}>Add Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Children */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  triggerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  triggerButtonText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  walletList: {
    paddingHorizontal: 16,
    maxHeight: 400,
  },
  walletItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  walletItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
    fontWeight: "500",
  },
  editInput: {
    fontSize: 14,
    fontWeight: "600",
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  walletActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  checkIcon: {
    opacity: 0,
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  addWalletButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addWalletButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MultiWalletManager;
