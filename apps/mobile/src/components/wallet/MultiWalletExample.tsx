import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMultiWalletManager } from "../../hooks/useMultiWalletManager";
import { useTheme } from "../../theme/ThemeContext";
import { Transaction, PublicKey } from "@solana/web3.js";
import { formatAddress } from "../../utils";
import type { WalletSession } from "../../types/multiWallet";

/**
 * Example component demonstrating the complete multi-wallet manager functionality.
 *
 * This example shows:
 * 1. Adding multiple wallets (Phantom + Solflare + Backpack)
 * 2. Switching between wallets
 * 3. Signing transactions with specific wallets
 * 4. Signing messages
 * 5. Removing wallets
 * 6. Auto-reconnection using persisted auth tokens
 *
 * @example
 * ```typescript
 * function App() {
 *   return (
 *     <ScrollView>
 *       <MultiWalletExample />
 *     </ScrollView>
 *   );
 * }
 * ```
 */
export const MultiWalletExample: React.FC = () => {
  const { theme } = useTheme();
  const {
    sessions,
    activeSession,
    isLoading,
    error,
    addWallet,
    removeWallet,
    setActiveWallet,
    signTransaction,
    signMessage,
    disconnectAll,
    updateWalletLabel,
    hasWallets,
    walletCount,
  } = useMultiWalletManager();

  const [isSigning, setIsSigning] = useState(false);

  /**
   * Example 1: Add a new wallet with custom label
   */
  const handleAddWallet = useCallback(async () => {
    try {
      // MWA will automatically show the wallet selector
      const result = await addWallet({
        label: `Wallet ${walletCount + 1}`,
      });
      Alert.alert(
        "Success",
        `Connected ${result.session.label} successfully!`,
      );
    } catch (err: any) {
      console.error("Failed to add wallet:", err);
      Alert.alert("Error", err.message);
    }
  }, [addWallet, walletCount]);

  /**
   * Example 2: Sign a transaction with active wallet
   */
  const handleSignTransaction = useCallback(async () => {
    if (!activeSession) {
      Alert.alert("Error", "Please select a wallet first");
      return;
    }

    try {
      setIsSigning(true);

      // Create a simple transaction (example: create account instruction)
      const transaction = new Transaction().add({
        keys: [
          {
            pubkey: new PublicKey(activeSession.address),
            isSigner: true,
            isWritable: true,
          },
        ],
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
        data: Buffer.from("Hello from WalletHub!", "utf-8"),
      });

      // Sign with active wallet
      const signedTransaction = await signTransaction(transaction);

      Alert.alert(
        "Transaction Signed",
        `Successfully signed transaction with ${activeSession.label}!\n\nSignature length: ${signedTransaction.length} bytes`,
      );
    } catch (err: any) {
      console.error("Transaction signing failed:", err);
      Alert.alert("Error", err.message);
    } finally {
      setIsSigning(false);
    }
  }, [activeSession, signTransaction]);

  /**
   * Example 3: Sign a message with specific wallet
   */
  const handleSignMessage = useCallback(async () => {
    if (!activeSession) {
      Alert.alert("Error", "Please select a wallet first");
      return;
    }

    try {
      setIsSigning(true);

      const message = new TextEncoder().encode(
        `Sign-in message from WalletHub\nTimestamp: ${Date.now()}\nWallet: ${activeSession.address}`,
      );

      const signature = await signMessage(message);

      Alert.alert(
        "Message Signed",
        `Successfully signed message with ${activeSession.label}!\n\nSignature: ${Buffer.from(signature).toString("hex").substring(0, 50)}...`,
      );
    } catch (err: any) {
      console.error("Message signing failed:", err);
      Alert.alert("Error", err.message);
    } finally {
      setIsSigning(false);
    }
  }, [activeSession, signMessage]);

  /**
   * Example 4: Remove a wallet
   */
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
                Alert.alert("Success", `${label} removed successfully`);
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

  /**
   * Example 5: Update wallet label
   */
  const handleUpdateLabel = useCallback(
    (sessionId: string, currentLabel: string) => {
      Alert.prompt(
        "Edit Label",
        "Enter a new label for this wallet",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: (newLabel: string | undefined) => {
              if (newLabel && newLabel.trim()) {
                updateWalletLabel(sessionId, newLabel.trim());
                Alert.alert("Success", "Label updated");
              }
            },
          },
        ],
        "plain-text",
        currentLabel,
      );
    },
    [updateWalletLabel],
  );

  /**
   * Example 6: Disconnect all wallets
   */
  const handleDisconnectAll = useCallback(() => {
    Alert.alert(
      "Disconnect All",
      `Are you sure you want to disconnect all ${walletCount} wallets?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect All",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectAll();
              Alert.alert("Success", "All wallets disconnected");
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ],
    );
  }, [disconnectAll, walletCount]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Multi-Wallet Manager
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
          Manage multiple wallet connections simultaneously
        </Text>
      </View>

      {/* Error Display */}
      {error && (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: theme.colors.error + "20" },
          ]}
        >
          <Feather name="alert-circle" size={16} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
            Processing...
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View
          style={[styles.statBox, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
            {walletCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurface }]}>
            Connected Wallets
          </Text>
        </View>
        <View
          style={[styles.statBox, { backgroundColor: theme.colors.surface }]}
        >
          <Text style={[styles.statNumber, { color: theme.colors.success }]}>
            {activeSession ? "1" : "0"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.onSurface }]}>
            Active Wallet
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleAddWallet}
          disabled={isLoading}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Add Wallet</Text>
        </TouchableOpacity>

        {hasWallets && (
          <>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.secondary },
              ]}
              onPress={handleSignTransaction}
              disabled={isLoading || !activeSession || isSigning}
            >
              <Feather name="edit" size={20} color="#050814" />
              <Text style={[styles.actionButtonText, { color: "#050814" }]}>
                Sign Transaction
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={handleSignMessage}
              disabled={isLoading || !activeSession || isSigning}
            >
              <Feather
                name="message-square"
                size={20}
                color={theme.colors.text}
              />
              <Text
                style={[styles.actionButtonText, { color: theme.colors.text }]}
              >
                Sign Message
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.error },
              ]}
              onPress={handleDisconnectAll}
              disabled={isLoading}
            >
              <Feather name="power" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Disconnect All</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Wallet List */}
      <View style={styles.walletListContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Connected Wallets
        </Text>

        {!hasWallets ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Feather
              name="credit-card"
              size={48}
              color={theme.colors.onSurface}
            />
            <Text
              style={[styles.emptyStateTitle, { color: theme.colors.text }]}
            >
              No Wallets Connected
            </Text>
            <Text
              style={[styles.emptyStateText, { color: theme.colors.onSurface }]}
            >
              Tap "Add Wallet" to connect your first wallet
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.walletList}>
            {sessions.map((session: WalletSession) => (
              <View
                key={session.sessionId}
                style={[
                  styles.walletCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor:
                      activeSession?.sessionId === session.sessionId
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                    borderWidth:
                      activeSession?.sessionId === session.sessionId ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.walletCardHeader}>
                  <View
                    style={[
                      styles.walletCardIcon,
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
                      size={24}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.walletCardInfo}>
                    <Text
                      style={[
                        styles.walletCardLabel,
                        { color: theme.colors.text },
                      ]}
                    >
                      {session.label}
                    </Text>
                    <Text
                      style={[
                        styles.walletCardAddress,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      {formatAddress(session.address)}
                    </Text>
                  </View>

                  {activeSession?.sessionId === session.sessionId && (
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
                </View>

                <View style={styles.walletCardActions}>
                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() => setActiveWallet(session.sessionId)}
                  >
                    <Feather
                      name="check"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.walletActionButtonText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Set Active
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() =>
                      handleUpdateLabel(session.sessionId, session.label)
                    }
                  >
                    <Feather
                      name="edit-2"
                      size={16}
                      color={theme.colors.onSurface}
                    />
                    <Text
                      style={[
                        styles.walletActionButtonText,
                        { color: theme.colors.onSurface },
                      ]}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.walletActionButton}
                    onPress={() =>
                      handleRemoveWallet(session.sessionId, session.label)
                    }
                  >
                    <Feather name="trash-2" size={16} color="#FF8BA7" />
                    <Text
                      style={[
                        styles.walletActionButtonText,
                        { color: "#FF8BA7" },
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Usage Instructions */}
      <View
        style={[styles.instructions, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={[styles.instructionsTitle, { color: theme.colors.text }]}>
          How to Use
        </Text>
        <Text
          style={[styles.instructionsText, { color: theme.colors.onSurface }]}
        >
          1. Tap "Add Wallet" to connect a new wallet{"\n"}
          2. Select from Phantom, Solflare, or Backpack{"\n"}
          3. Each wallet creates an independent session{"\n"}
          4. Switch between wallets instantly{"\n"}
          5. Sign transactions/messages with specific wallets{"\n"}
          6. Auth tokens are persisted for auto-reconnect
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
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
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  actionContainer: {
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  walletListContainer: {
    flex: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
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
  walletList: {
    maxHeight: 400,
  },
  walletCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  walletCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  walletCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  walletCardInfo: {
    flex: 1,
  },
  walletCardLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  walletCardAddress: {
    fontSize: 12,
    fontWeight: "500",
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
  walletCardActions: {
    flexDirection: "row",
    gap: 8,
  },
  walletActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  walletActionButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  instructions: {
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
});

export default MultiWalletExample;
