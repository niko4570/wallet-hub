import {
  SessionKey,
  SessionKeySettings,
  SilentReauthorizationRecord,
  TransactionAuditEntry,
} from "@wallethub/contracts";
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
import type {
  AuthorizationPreview,
  DetectedWalletApp,
  LinkedWallet,
} from "./src/types/wallet";
import { requireBiometricApproval } from "./src/security/biometrics";
import { authorizationApi } from "./src/services/authorizationService";

// Suppress zeego warning (not using native menus yet)
// import '@tamagui/native/setup-zeego';

SplashScreen.preventAutoHideAsync();

const formatUsd = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatAddress = (address?: string | null) => {
  if (!address) {
    return "Not Connected";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatSignature = (signature: string) =>
  `${signature.slice(0, 6)}...${signature.slice(-4)}`;

const reauthStatusColors: Record<
  SilentReauthorizationRecord["status"],
  { bg: string; border: string; text: string }
> = {
  fresh: {
    bg: "rgba(0, 255, 179, 0.12)",
    border: "rgba(0, 255, 179, 0.4)",
    text: "#00FFB3",
  },
  stale: {
    bg: "rgba(255, 196, 0, 0.15)",
    border: "rgba(255, 196, 0, 0.4)",
    text: "#FFC400",
  },
  expired: {
    bg: "rgba(255, 77, 77, 0.15)",
    border: "rgba(255, 77, 77, 0.5)",
    text: "#FF4D4D",
  },
  error: {
    bg: "rgba(255, 77, 77, 0.15)",
    border: "rgba(255, 77, 77, 0.5)",
    text: "#FF4D4D",
  },
};

const getReauthStatusStyle = (status: SilentReauthorizationRecord["status"]) =>
  reauthStatusColors[status] ?? reauthStatusColors.fresh;

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
  walletActiveLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 4,
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
  walletActions: {
    alignItems: "flex-end",
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: "#8EA4FF",
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
  sectionSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
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
  walletCardActive: {
    borderColor: "#8EA4FF",
  },
  walletCardTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  walletCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  walletActiveBadge: {
    color: "#8EA4FF",
    fontWeight: "700",
    fontSize: 12,
  },
  walletActionsRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  walletActionLink: {
    color: "#8EA4FF",
    fontWeight: "700",
    fontSize: 13,
  },
  walletActionLinkSpacing: {
    marginLeft: 16,
  },
  walletOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  walletOptionDisabled: {
    opacity: 0.4,
  },
  walletOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  walletOptionDetails: {
    flex: 1,
  },
  walletOptionTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  walletOptionSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  walletOptionStatus: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  walletOptionStatusActive: {
    color: "#8EA4FF",
  },
  walletOptionStatusInactive: {
    color: "rgba(255,255,255,0.4)",
  },
  fullWidthButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  fullWidthButtonText: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "700",
  },
  accountOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  accountOptionDetails: {
    flex: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    marginRight: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderColor: "#8EA4FF",
    backgroundColor: "rgba(142,164,255,0.15)",
  },
  checkboxMark: {
    color: "#8EA4FF",
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  confirmButton: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.4,
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
  headerActionButton: {
    minWidth: 140,
    height: 40,
    paddingVertical: 8,
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
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reauthMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 8,
  },
  auditCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  auditSignature: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  auditMeta: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  auditStatus: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  auditStatusSubmitted: {
    backgroundColor: "rgba(0, 255, 179, 0.12)",
    color: "#00FFB3",
  },
  auditStatusFailed: {
    backgroundColor: "rgba(255, 77, 77, 0.12)",
    color: "#FF4D4D",
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
  sheetSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginBottom: 16,
  },
  attributionText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 8,
    textDecorationLine: "underline",
  },
});

export default function App() {
  const {
    disconnect,
    sendSol,
    linkedWallets,
    activeWallet,
    selectActiveWallet,
    balances,
    refreshBalance,
    availableWallets,
    detectingWallets,
    refreshWalletDetection,
    startAuthorization,
    finalizeAuthorization,
    silentRefreshAuthorization,
  } = useSolana();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([]);
  const [sessionSettings, setSessionSettings] =
    useState<SessionKeySettings | null>(null);
  const [silentReauths, setSilentReauths] = useState<
    SilentReauthorizationRecord[]
  >([]);
  const [auditLog, setAuditLog] = useState<TransactionAuditEntry[]>([]);
  const [silentRefreshLoading, setSilentRefreshLoading] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [walletSelectionVisible, setWalletSelectionVisible] = useState(false);
  const [accountSelectionVisible, setAccountSelectionVisible] = useState(false);
  const [authorizationPreview, setAuthorizationPreview] =
    useState<AuthorizationPreview | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<string, boolean>
  >({});
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const totalBalanceLamports = useMemo(
    () =>
      linkedWallets.reduce(
        (sum, wallet) => sum + (balances[wallet.address] ?? 0),
        0,
      ),
    [linkedWallets, balances],
  );
  const activeBalanceLamports = activeWallet
    ? (balances[activeWallet.address] ?? null)
    : null;
  const isConnected = linkedWallets.length > 0;
  const selectedAccountCount = useMemo(
    () => Object.values(selectedAccounts).filter(Boolean).length,
    [selectedAccounts],
  );
  const totalAccountsInPreview = authorizationPreview?.accounts.length ?? 0;
  const sortedWalletOptions = useMemo(() => {
    return [...availableWallets].sort((a, b) => {
      if (a.installed === b.installed) {
        return a.name.localeCompare(b.name);
      }
      return a.installed ? -1 : 1;
    });
  }, [availableWallets]);

  const loadSecurityData = useCallback(async () => {
    try {
      const [
        fetchedSessionKeys,
        fetchedSilentReauths,
        fetchedSettings,
        fetchedAudits,
      ] = await Promise.all([
        authorizationApi.fetchSessionKeys().catch(() => []),
        authorizationApi.fetchSilentReauthorizations().catch(() => []),
        authorizationApi.fetchSessionSettings().catch(() => null),
        authorizationApi.fetchTransactionAudits().catch(() => []),
      ]);

      setSessionKeys(fetchedSessionKeys);
      setSilentReauths(fetchedSilentReauths);
      if (fetchedSettings) {
        setSessionSettings(fetchedSettings);
      }
      setAuditLog(fetchedAudits);
    } catch (err) {
      console.warn("Failed to load security data", err);
    }
  }, []);

  useEffect(() => {
    // Hide splash screen once app is ready
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    loadSecurityData();
  }, [loadSecurityData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setError(null);
      await Promise.all([
        refreshWalletDetection().catch((err) =>
          console.warn("Wallet detection refresh failed", err),
        ),
        loadSecurityData(),
        ...linkedWallets.map((wallet) =>
          refreshBalance(wallet.address).catch((err) => {
            console.warn(`Balance refresh failed for ${wallet.address}`, err);
          }),
        ),
      ]);
    } catch (err) {
      setError("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, loadSecurityData, refreshBalance, refreshWalletDetection]);

  const openCoinGecko = useCallback(() => {
    Linking.openURL(
      "https://www.coingecko.com/?utm_source=wallethub&utm_medium=referral",
    ).catch((err) => console.warn("Failed to open CoinGecko", err));
  }, []);

  const openWalletSelector = useCallback(async () => {
    setError(null);
    setAuthorizationPreview(null);
    setSelectedAccounts({});
    setWalletSelectionVisible(true);
    try {
      await refreshWalletDetection();
    } catch (err) {
      console.warn("Wallet detection refresh failed", err);
    }
  }, [refreshWalletDetection]);

  const handleDisconnect = useCallback(
    async (address?: string) => {
      try {
        setError(null);
        await disconnect(address);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to disconnect wallet";
        setError(message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [disconnect],
  );

  const handleSelectWalletApp = useCallback(
    async (wallet?: DetectedWalletApp) => {
      try {
        setAuthorizationLoading(true);
        setError(null);
        const preview = await startAuthorization(wallet);
        const initialSelection = Object.fromEntries(
          preview.accounts.map((account) => [account.address, true]),
        );
        setSelectedAccounts(initialSelection);
        setAuthorizationPreview(preview);
        setWalletSelectionVisible(false);
        setAccountSelectionVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to authorize wallet";
        setError(message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setAuthorizationLoading(false);
      }
    },
    [startAuthorization],
  );

  const handleToggleAccount = useCallback((address: string) => {
    setSelectedAccounts((prev) => ({
      ...prev,
      [address]: !prev[address],
    }));
  }, []);

  const handleConfirmAccounts = useCallback(async () => {
    if (!authorizationPreview) return;
    const selectedAddresses = Object.entries(selectedAccounts)
      .filter(([, checked]) => checked)
      .map(([address]) => address);
    try {
      setAuthorizationLoading(true);
      setError(null);

      // Validate at least one account is selected
      if (selectedAddresses.length === 0) {
        throw new Error("Select at least one account to continue");
      }

      await finalizeAuthorization(authorizationPreview, selectedAddresses);
      setAccountSelectionVisible(false);
      setAuthorizationPreview(null);
      setSelectedAccounts({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to link selected accounts";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAuthorizationLoading(false);
    }
  }, [authorizationPreview, finalizeAuthorization, selectedAccounts]);

  const handleCancelAccountSelection = useCallback(() => {
    setAccountSelectionVisible(false);
    setAuthorizationPreview(null);
    setSelectedAccounts({});
  }, []);

  const handleSelectWallet = useCallback(
    async (address: string) => {
      selectActiveWallet(address);
      try {
        await refreshBalance(address);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.warn(`Failed to refresh balance for ${address}`, err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    },
    [refreshBalance, selectActiveWallet],
  );

  const handleSilentRefresh = useCallback(async () => {
    if (linkedWallets.length === 0) {
      const message = "Connect a wallet before refreshing tokens";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSilentRefreshLoading(true);
    try {
      const results = await Promise.all(
        linkedWallets.map((wallet) =>
          silentRefreshAuthorization(wallet.address).catch((err) => {
            console.warn(
              `Silent re-authorization failed for ${wallet.address}`,
              err,
            );
            return null;
          }),
        ),
      );

      const nextRecords = results.filter(
        (record): record is SilentReauthorizationRecord => Boolean(record),
      );

      if (nextRecords.length > 0) {
        setSilentReauths((prev) => {
          const map = new Map(
            prev.map((record) => [
              `${record.walletAddress}-${record.walletAppId ?? "default"}`,
              record,
            ]),
          );

          nextRecords.forEach((record) => {
            map.set(
              `${record.walletAddress}-${record.walletAppId ?? "default"}`,
              record,
            );
          });

          return Array.from(map.values());
        });
      }

      setError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh authorizations";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSilentRefreshLoading(false);
    }
  }, [linkedWallets, silentRefreshAuthorization]);

  const handleOpenSessionModal = useCallback(async () => {
    try {
      setError(null);
      await requireBiometricApproval("Authenticate to manage session keys");
      await loadSecurityData();
      setShowSessionModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Biometric authentication failed";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [loadSecurityData]);

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
              {totalBalanceLamports
                ? `${(totalBalanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                : "0 SOL"}
            </Text>
            <Text style={styles.balanceValueText}>
              {totalBalanceLamports
                ? formatUsd((totalBalanceLamports / LAMPORTS_PER_SOL) * 100)
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
                  {isConnected
                    ? `${linkedWallets.length} wallet${linkedWallets.length > 1 ? "s" : ""} connected`
                    : "Disconnected"}
                </Text>
                <Text style={styles.walletActiveLabel}>
                  Active: {formatAddress(activeWallet?.address)}
                </Text>
              </View>
              <View style={styles.walletActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={openWalletSelector}
                >
                  <Text style={styles.actionButtonText}>
                    {isConnected ? "Add Wallet" : "Connect Wallet"}
                  </Text>
                </TouchableOpacity>
                {activeWallet && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => handleDisconnect(activeWallet.address)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Disconnect Active
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Wallets Section */}
          <View style={styles.walletsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Wallets</Text>
              {isConnected && (
                <Text style={styles.sectionSubtitle}>
                  {linkedWallets.length} linked
                </Text>
              )}
            </View>
            {linkedWallets.length === 0 ? (
              <View style={styles.walletCard}>
                <Text style={styles.walletCardTitle}>No wallets linked</Text>
                <Text style={styles.walletLabel}>
                  Use “Connect Wallet” to add your first account.
                </Text>
              </View>
            ) : (
              linkedWallets.map((wallet) => {
                const walletBalance = balances[wallet.address] ?? null;
                const isActiveWallet = activeWallet?.address === wallet.address;
                return (
                  <View
                    key={wallet.address}
                    style={[
                      styles.walletCard,
                      isActiveWallet && styles.walletCardActive,
                    ]}
                  >
                    <View style={styles.walletCardHeader}>
                      <View>
                        <Text style={styles.walletCardTitle}>
                          {wallet.label ?? "Linked Wallet"}
                        </Text>
                        <Text style={styles.walletAddress}>
                          {formatAddress(wallet.address)}
                        </Text>
                        <Text style={styles.walletLabel}>Solana Mainnet</Text>
                      </View>
                      {isActiveWallet && (
                        <Text style={styles.walletActiveBadge}>Active</Text>
                      )}
                    </View>
                    <View style={styles.walletCardContent}>
                      <View style={styles.walletBalance}>
                        <Text style={styles.balanceAmount}>
                          {walletBalance
                            ? `${(walletBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                            : "0 SOL"}
                        </Text>
                        <Text style={styles.balanceValue}>
                          {walletBalance
                            ? formatUsd(
                                (walletBalance / LAMPORTS_PER_SOL) * 100,
                              )
                            : "$0.00"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.walletActionsRow}>
                      {!isActiveWallet && (
                        <TouchableOpacity
                          onPress={() => handleSelectWallet(wallet.address)}
                        >
                          <Text style={styles.walletActionLink}>
                            Set Active
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={
                          !isActiveWallet
                            ? styles.walletActionLinkSpacing
                            : undefined
                        }
                        onPress={() => handleDisconnect(wallet.address)}
                      >
                        <Text style={styles.walletActionLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Session Keys Section */}
          <View style={styles.sessionKeysSection}>
            <View style={styles.sessionKeysHeader}>
              <Text style={styles.sectionTitle}>Session Keys</Text>
              <TouchableOpacity onPress={handleOpenSessionModal}>
                <Text style={styles.actionButtonText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {sessionSettings && (
              <Text style={styles.sectionSubtitle}>
                {sessionSettings.message}
              </Text>
            )}
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

          {/* Silent Re-Authorization Section */}
          <View style={styles.sessionKeysSection}>
            <View style={styles.sessionKeysHeader}>
              <Text style={styles.sectionTitle}>Silent Re-Authorization</Text>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.headerActionButton,
                  (silentRefreshLoading || linkedWallets.length === 0) &&
                    styles.disabledButton,
                ]}
                onPress={handleSilentRefresh}
                disabled={silentRefreshLoading || linkedWallets.length === 0}
              >
                {silentRefreshLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Refresh Tokens</Text>
                )}
              </TouchableOpacity>
            </View>
            {silentReauths.length === 0 ? (
              <View style={styles.glassCard}>
                <Text style={styles.balanceValueText}>
                  No silent re-authorization events yet.
                </Text>
              </View>
            ) : (
              silentReauths.map((record) => {
                const statusStyle = getReauthStatusStyle(record.status);
                return (
                  <View key={record.id} style={styles.sessionCard}>
                    <View style={styles.sessionCardHeader}>
                      <View>
                        <Text style={styles.sessionDevice}>
                          {record.walletName ??
                            formatAddress(record.walletAddress)}
                        </Text>
                        <Text style={styles.sessionExpires}>
                          Last refreshed:{" "}
                          {new Date(record.lastRefreshedAt).toLocaleString()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusChip,
                          {
                            backgroundColor: statusStyle.bg,
                            borderColor: statusStyle.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusChipText,
                            { color: statusStyle.text },
                          ]}
                        >
                          {record.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reauthMeta}>
                      Method: {record.method} · Token ••••
                      {record.authTokenHint ?? "----"}
                    </Text>
                    <Text style={styles.reauthMeta}>
                      Capabilities:{" "}
                      {record.capabilities.supportedTransactionVersions?.join(
                        ", ",
                      ) || "legacy"}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Audit Log Section */}
          <View style={styles.sessionKeysSection}>
            <View style={styles.sessionKeysHeader}>
              <Text style={styles.sectionTitle}>Recent Signatures</Text>
            </View>
            {auditLog.length === 0 ? (
              <View style={styles.glassCard}>
                <Text style={styles.balanceValueText}>
                  No audited transactions yet.
                </Text>
              </View>
            ) : (
              auditLog.slice(0, 4).map((entry) => (
                <View key={entry.id} style={styles.auditCard}>
                  <Text style={styles.auditSignature}>
                    {formatSignature(entry.signature)}
                  </Text>
                  <Text style={styles.auditMeta}>
                    {formatAddress(entry.sourceWalletAddress)} →{" "}
                    {formatAddress(entry.destinationAddress)}
                  </Text>
                  <Text style={styles.auditMeta}>
                    Primitive: {entry.authorizationPrimitive} ·{" "}
                    {(entry.amountLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL
                  </Text>
                  <Text
                    style={[
                      styles.auditStatus,
                      entry.status === "submitted"
                        ? styles.auditStatusSubmitted
                        : styles.auditStatusFailed,
                    ]}
                  >
                    {entry.status}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Wallet Selection Modal */}
        <Modal
          visible={walletSelectionVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setWalletSelectionVisible(false)}
        >
          <Pressable
            style={styles.sheetOverlay}
            onPress={() => setWalletSelectionVisible(false)}
          >
            <Pressable
              style={styles.sheetContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Select a Wallet</Text>
              <Text style={styles.sheetSubtitle}>
                Detected Mobile Wallet Adapter apps on your device
              </Text>
              {detectingWallets ? (
                <ActivityIndicator style={styles.spinner} color="#8EA4FF" />
              ) : (
                sortedWalletOptions.map((wallet) => {
                  const disabled =
                    !wallet.installed && wallet.detectionMethod !== "fallback";
                  return (
                    <TouchableOpacity
                      key={wallet.id}
                      style={[
                        styles.walletOption,
                        disabled && styles.walletOptionDisabled,
                      ]}
                      disabled={disabled || authorizationLoading}
                      onPress={() =>
                        handleSelectWalletApp(
                          wallet.detectionMethod === "fallback"
                            ? undefined
                            : wallet,
                        )
                      }
                    >
                      <View style={styles.walletOptionIcon}>
                        <Text>{wallet.icon}</Text>
                      </View>
                      <View style={styles.walletOptionDetails}>
                        <Text style={styles.walletOptionTitle}>
                          {wallet.name}
                        </Text>
                        {wallet.subtitle && (
                          <Text style={styles.walletOptionSubtitle}>
                            {wallet.subtitle}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.walletOptionStatus,
                          wallet.installed
                            ? styles.walletOptionStatusActive
                            : styles.walletOptionStatusInactive,
                        ]}
                      >
                        {wallet.installed ? "Installed" : "Not detected"}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
              <TouchableOpacity
                style={styles.fullWidthButton}
                onPress={() => handleSelectWalletApp(undefined)}
                disabled={authorizationLoading}
              >
                <Text style={styles.fullWidthButtonText}>
                  Use system picker
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Account Selection Modal */}
        <Modal
          visible={accountSelectionVisible}
          transparent
          animationType="slide"
          onRequestClose={handleCancelAccountSelection}
        >
          <Pressable
            style={styles.sheetOverlay}
            onPress={handleCancelAccountSelection}
          >
            <Pressable
              style={styles.sheetContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose Accounts</Text>
              <Text style={styles.sheetSubtitle}>
                Select the accounts from this wallet you want to aggregate
              </Text>
              {authorizationPreview ? (
                authorizationPreview.accounts.map((account: LinkedWallet) => {
                  const checked = selectedAccounts[account.address];
                  return (
                    <Pressable
                      key={account.address}
                      style={styles.accountOption}
                      onPress={() => handleToggleAccount(account.address)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <View style={styles.accountOptionDetails}>
                        <Text style={styles.walletCardTitle}>
                          {account.label ?? "Wallet Account"}
                        </Text>
                        <Text style={styles.walletAddress}>
                          {formatAddress(account.address)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.glassCard}>
                  <Text style={styles.balanceValueText}>
                    No accounts returned from wallet
                  </Text>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleCancelAccountSelection}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.confirmButton,
                    (selectedAccountCount === 0 || authorizationLoading) &&
                      styles.disabledButton,
                  ]}
                  disabled={selectedAccountCount === 0 || authorizationLoading}
                  onPress={handleConfirmAccounts}
                >
                  {authorizationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      Link {selectedAccountCount}/{totalAccountsInPreview || 1}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
              <Text style={styles.sheetSubtitle}>
                {sessionSettings?.message ??
                  "Review authorization health and audit history."}
              </Text>
              <View style={styles.separator} />
              <Text style={styles.sectionTitle}>Audit Trail</Text>
              {auditLog.length === 0 ? (
                <Text style={styles.balanceValueText}>
                  No transactions recorded yet.
                </Text>
              ) : (
                auditLog.slice(0, 5).map((entry) => (
                  <View key={entry.id} style={styles.auditCard}>
                    <Text style={styles.auditSignature}>
                      {formatSignature(entry.signature)}
                    </Text>
                    <Text style={styles.auditMeta}>
                      {new Date(entry.recordedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.auditMeta}>
                      {entry.authorizationPrimitive} ·{" "}
                      {(entry.amountLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL
                    </Text>
                    <Text
                      style={[
                        styles.auditStatus,
                        entry.status === "submitted"
                          ? styles.auditStatusSubmitted
                          : styles.auditStatusFailed,
                      ]}
                    >
                      {entry.status}
                    </Text>
                  </View>
                ))
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
