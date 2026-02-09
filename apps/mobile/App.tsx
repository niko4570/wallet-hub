import { SessionKey } from "@wallethub/contracts";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  RefreshControl,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as Haptics from "expo-haptics";
import { useSolana } from "./src/hooks/useSolana";
import { API_URL, COINGECKO_API_KEY } from "./src/config/env";

// Suppress zeego warning (not using native menus yet)
// import '@tamagui/native/setup-zeego';

SplashScreen.preventAutoHideAsync();

const formatUsd = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050914",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1,
    color: "white",
  },
  shieldIcon: {
    backgroundColor: "rgba(255,255,255,0.08)",
    width: 40,
    height: 40,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  shieldIconText: {
    fontSize: 16,
  },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
  },
  errorCard: {
    backgroundColor: "rgba(255, 77, 77, 0.1)",
    borderColor: "#FF4D4D",
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
  },
  errorText: {
    color: "#FF4D4D",
  },
  heroSection: {
    marginBottom: 24,
  },
  heroTitle: {
    color: "#8EA4FF",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
    opacity: 0.8,
    marginBottom: 8,
  },
  balanceText: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 48,
    color: "white",
    marginBottom: 8,
  },
  balanceValueText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  walletControl: {
    marginBottom: 24,
  },
  walletStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  walletStatusText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  walletAddressText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  actionButton: {
    backgroundColor: "#8EA4FF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "700",
  },
  sendButton: {
    backgroundColor: "#8EA4FF",
    paddingVertical: 12,
    borderRadius: 16,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  sendButtonText: {
    color: "white",
    fontWeight: "700",
  },
  walletsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 14,
  },
  spinner: {
    marginVertical: 24,
  },
  walletCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
  },
  walletCardTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  walletCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  walletInfo: {
    flex: 1,
  },
  walletAddress: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  walletLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  walletBalance: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 4,
  },
  balanceValue: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  sessionKeysSection: {
    marginBottom: 24,
  },
  sessionKeysHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sessionCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 32,
    padding: 24,
    marginBottom: 16,
  },
  sessionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sessionDevice: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  sessionExpires: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  sessionStatus: {
    backgroundColor: "rgba(0, 255, 179, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 179, 0.3)",
  },
  sessionStatusText: {
    color: "#00FFB3",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 16,
  },
  sessionScopes: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  scopeTag: {
    backgroundColor: "rgba(142, 164, 255, 0.1)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  scopeTagText: {
    color: "#8EA4FF",
    fontSize: 11,
    fontWeight: "600",
  },
  revokeButton: {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  revokeButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContent: {
    backgroundColor: "#0B1221",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 48,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  sheetTitle: {
    color: "#8EA4FF",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 14,
  },
  attributionText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 8,
    textDecorationLine: "underline",
  },
});

export default function App() {
  const { connect, disconnect, sendSol, balanceLamports } = useSolana();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);

  useEffect(() => {
    // Hide splash screen once app is ready
    SplashScreen.hideAsync();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setError(null);
      // Refresh balance and session keys
    } catch (err) {
      setError("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const openCoinGecko = useCallback(() => {
    Linking.openURL(
      "https://www.coingecko.com/?utm_source=wallethub&utm_medium=referral",
    ).catch((err) => console.warn("Failed to open CoinGecko", err));
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      setError(null);
      await connect();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError("Failed to connect wallet");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [connect]);

  const handleDisconnect = useCallback(async () => {
    try {
      setError(null);
      await disconnect();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError("Failed to disconnect wallet");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [disconnect]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8EA4FF"
              colors={["#8EA4FF"]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>WalletHub</Text>
            <View style={styles.shieldIcon}>
              <Text style={styles.shieldIconText}>🔒</Text>
            </View>
          </View>

          {/* Error Card */}
          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={styles.heroTitle}>Your Balance</Text>
            <Text style={styles.balanceText}>
              {balanceLamports
                ? `${(balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                : "0 SOL"}
            </Text>
            <Text style={styles.balanceValueText}>
              {balanceLamports
                ? formatUsd((balanceLamports / LAMPORTS_PER_SOL) * 100)
                : "$0.00"}
            </Text>
            <Text style={styles.attributionText} onPress={openCoinGecko}>
              Price data provided by CoinGecko
            </Text>
          </View>

          {/* Wallet Control */}
          <View style={styles.walletControl}>
            <View style={styles.walletStatus}>
              <View>
                <Text style={styles.walletStatusText}>Wallet Status</Text>
                <Text style={styles.walletAddressText}>
                  {balanceLamports ? "Connected" : "Disconnected"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={balanceLamports ? handleDisconnect : handleConnect}
              >
                <Text style={styles.actionButtonText}>
                  {balanceLamports ? "Disconnect" : "Connect Wallet"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Wallets Section */}
          <View style={styles.walletsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Wallets</Text>
            </View>
            <View style={styles.walletCard}>
              <Text style={styles.walletCardTitle}>Primary Wallet</Text>
              <View style={styles.walletCardContent}>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletAddress}>
                    {balanceLamports ? "..." : "Not Connected"}
                  </Text>
                  <Text style={styles.walletLabel}>Solana Mainnet</Text>
                </View>
                <View style={styles.walletBalance}>
                  <Text style={styles.balanceAmount}>
                    {balanceLamports
                      ? `${(balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                      : "0 SOL"}
                  </Text>
                  <Text style={styles.balanceValue}>
                    {balanceLamports
                      ? formatUsd((balanceLamports / LAMPORTS_PER_SOL) * 100)
                      : "$0.00"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Session Keys Section */}
          <View style={styles.sessionKeysSection}>
            <View style={styles.sessionKeysHeader}>
              <Text style={styles.sectionTitle}>Session Keys</Text>
              <TouchableOpacity onPress={() => setShowSessionModal(true)}>
                <Text style={styles.actionButtonText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {sessionKeys.length === 0 ? (
              <View style={styles.glassCard}>
                <Text style={styles.balanceValueText}>No active sessions</Text>
              </View>
            ) : (
              sessionKeys.map((key, index) => (
                <View key={index} style={styles.sessionCard}>
                  <View style={styles.sessionCardHeader}>
                    <View>
                      <Text style={styles.sessionDevice}>
                        {key.metadata?.device || "Unknown Device"}
                      </Text>
                      <Text style={styles.sessionExpires}>
                        Expires: {new Date(key.expiresAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.sessionStatus}>
                      <Text style={styles.sessionStatusText}>Active</Text>
                    </View>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.sessionScopes}>
                    {key.scopes.map((scope, scopeIndex) => (
                      <View key={scopeIndex} style={styles.scopeTag}>
                        <Text style={styles.scopeTagText}>{scope.name}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.revokeButton}>
                    <Text style={styles.revokeButtonText}>Revoke</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Session Management Modal */}
        <Modal
          visible={showSessionModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSessionModal(false)}
        >
          <Pressable
            style={styles.sheetOverlay}
            onPress={() => setShowSessionModal(false)}
          >
            <Pressable
              style={styles.sheetContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Session Management</Text>
              {/* Add session management content here */}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
