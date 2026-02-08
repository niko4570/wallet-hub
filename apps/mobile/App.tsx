import { SessionKey } from "@wallethub/contracts";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TamaguiProvider,
  YStack,
  XStack,
  Text,
  ScrollView,
  Theme,
  Button,
  Card,
  Spinner,
  H3,
  H6,
  Separator,
  Sheet,
  Input,
  styled,
} from "tamagui";
import config from "./tamagui.config";
import * as Haptics from "expo-haptics";
import { useSolana } from "./src/hooks/useSolana";

// Suppress zeego warning (not using native menus yet)
// import '@tamagui/native/setup-zeego';

SplashScreen.preventAutoHideAsync();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

const formatUsd = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const GlassCard = styled(Card, {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderColor: "$borderColor",
  borderWidth: 1,
  borderRadius: "$6", // 32px
  padding: "$4", // 24px
  elevation: 0,
  animation: "bouncy",
  hoverStyle: {
    backgroundColor: "rgba(255,255,255,0.06)",
    scale: 1.01,
  },
  pressStyle: {
    scale: 0.98,
  },
});

const ActionButton = styled(Button, {
  backgroundColor: "$colorFocus",
  color: "white",
  borderRadius: "$4", // 16px
  height: 48,
  animation: "bouncy",
  pressStyle: {
    scale: 0.96,
    opacity: 0.9,
  },
  onPressIn: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
});

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(errorPayload || "API error");
  }
  return response.json() as Promise<T>;
};

export default function App() {
  const [loaded] = useFonts({
    Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
    InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
  });

  const [sessions, setSessions] = useState<SessionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connect,
    disconnect,
    sendSol,
    account,
    isAuthenticated,
    balanceLamports,
    refreshBalance,
  } = useSolana();
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amountToSend, setAmountToSend] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        );
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) {
          setSolPriceUsd(data?.solana?.usd ?? null);
        }
      } catch (err) {
        console.warn("Unable to fetch SOL price", err);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const sessionResponse = await fetchJson<SessionKey[]>("/session");
      setSessions(sessionResponse);
      if (isAuthenticated) {
        await refreshBalance().catch((err) => {
          console.warn("Failed to refresh balance", err);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, refreshBalance]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      loadData();
    }
  }, [loaded, loadData]);

  useEffect(() => {
    if (!sendSheetOpen) {
      setSendFeedback(null);
    }
  }, [sendSheetOpen]);

  // 测试网络连接
  useEffect(() => {
    const testNetworkConnection = async () => {
      try {
        const response = await fetch('https://www.google.com');
        console.log('网络连接测试成功:', response.status);
      } catch (error) {
        console.error('网络连接测试失败:', error);
      }
    };
    testNetworkConnection();
  }, []);

  const handleIssueSessionKey = useCallback(async () => {
    if (!account?.address) {
      setWalletError("Connect a wallet to issue session keys.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    await fetchJson<SessionKey>("/session/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: account.address,
        devicePublicKey: "demo-device-public-key",
        expiresInMinutes: 60,
        scopes: [{ name: "transfer", maxUsd: 500 }],
        metadata: { device: "Saga Pro devkit" },
      }),
    });
    await loadData();
  }, [account, loadData]);

  const handleRevokeSessionKey = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await fetchJson(`/session/${id}`, { method: "DELETE" });
      await loadData();
    },
    [loadData],
  );

  const handleConnectWallet = useCallback(async () => {
    setWalletError(null);
    setWalletBusy(true);
    try {
      if (isAuthenticated) {
        await disconnect();
      } else {
        await connect();
      }
    } catch (err) {
      setWalletError(
        err instanceof Error ? err.message : "Wallet action failed",
      );
    } finally {
      setWalletBusy(false);
    }
  }, [connect, disconnect, isAuthenticated]);

  const handleSendSol = useCallback(async () => {
    setSendFeedback(null);
    const parsedAmount = parseFloat(amountToSend);
    if (!recipientAddress.trim()) {
      setSendFeedback({
        type: "error",
        message: "Recipient address is required.",
      });
      return;
    }
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setSendFeedback({
        type: "error",
        message: "Enter a valid amount greater than zero.",
      });
      return;
    }

    setSending(true);
    try {
      const signature = await sendSol(recipientAddress.trim(), parsedAmount);
      setSendFeedback({
        type: "success",
        message: `Sent ${parsedAmount} SOL · Sig ${signature.slice(0, 4)}...${signature.slice(-4)}`,
      });
      setRecipientAddress("");
      setAmountToSend("");
    } catch (err) {
      setSendFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Send failed",
      });
    } finally {
      setSending(false);
    }
  }, [amountToSend, recipientAddress, sendSol]);

  const solBalance = useMemo(
    () =>
      balanceLamports !== null
        ? balanceLamports / LAMPORTS_PER_SOL
        : null,
    [balanceLamports],
  );

  const solBalanceValueUsd = useMemo(() => {
    if (solBalance === null || solPriceUsd === null) {
      return null;
    }
    return solBalance * solPriceUsd;
  }, [solBalance, solPriceUsd]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="dark">
        <Theme name="dark">
          <SafeAreaView style={{ flex: 1, backgroundColor: "#050914" }}>
            <StatusBar style="light" />
            <ScrollView
              contentContainerStyle={{ paddingBottom: 120 }}
              refreshControl={
                // @ts-ignore
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={loadData}
                  tintColor="#8EA4FF"
                  colors={["#8EA4FF"]}
                />
              }
            >
              <YStack padding="$4" gap="$5">
                {/* Header */}
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  marginTop="$2"
                >
                  <H3 color="white" fontWeight="800" letterSpacing={1}>
                    WALLETHUB
                  </H3>
                  <YStack
                    backgroundColor="$surface2"
                    width={40}
                    height={40}
                    borderRadius="$8"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize={16}>🛡️</Text>
                  </YStack>
                </XStack>

                {error && (
                  <GlassCard
                    backgroundColor="rgba(255, 77, 77, 0.1)"
                    borderColor="$error"
                  >
                    <Text color="$error">{error}</Text>
                  </GlassCard>
                )}

                {/* Hero Section */}
                <GlassCard
                  padded
                  elevate
                  bordered
                  animation="bouncy"
                  pressStyle={{ scale: 0.98 }}
                >
                  <YStack gap="$2">
                    <H6
                      color="$colorFocus"
                      textTransform="uppercase"
                      letterSpacing={2}
                      fontSize={11}
                      opacity={0.8}
                    >
                      Live SOL Balance
                    </H6>
                    <H3
                      fontSize={42}
                      fontWeight="900"
                      letterSpacing={-1}
                      lineHeight={48}
                    >
                      {solBalance !== null
                        ? `${solBalance.toFixed(4)} SOL`
                        : "Connect wallet"}
                    </H3>
                    <Text color="$color" opacity={0.7} fontSize={14}>
                      {solBalanceValueUsd !== null
                        ? formatUsd(solBalanceValueUsd)
                        : solBalance !== null
                          ? "Fetching USD..."
                          : "Awaiting wallet"}
                    </Text>
                  </YStack>
                </GlassCard>

                {/* Wallet Control */}
                <GlassCard padded bordered>
                  <YStack gap="$3">
                    <XStack
                      justifyContent="space-between"
                      alignItems="center"
                      gap="$3"
                    >
                      <YStack gap="$1">
                        <Text
                          color="$color"
                          opacity={0.7}
                          fontSize={12}
                          textTransform="uppercase"
                          letterSpacing={1}
                        >
                          Wallet Status
                        </Text>
                        <Text color="white" fontWeight="700" fontSize={15}>
                          {isAuthenticated && account
                            ? `${account.address.slice(0, 4)}...${account.address.slice(-4)}`
                            : "Not connected"}
                        </Text>
                      </YStack>
                      <ActionButton
                        onPress={handleConnectWallet}
                        disabled={walletBusy}
                        paddingHorizontal="$3"
                        backgroundColor={
                          isAuthenticated
                            ? "rgba(255,255,255,0.08)"
                            : "$colorFocus"
                        }
                      >
                        <Text color="white" fontWeight="700">
                          {isAuthenticated ? "Disconnect" : "Connect"}
                        </Text>
                      </ActionButton>
                    </XStack>
                    {walletError && (
                      <Text color="$error" fontSize={12}>
                        {walletError}
                      </Text>
                    )}
                    <ActionButton
                      disabled={!isAuthenticated}
                      onPress={() => setSendSheetOpen(true)}
                      opacity={isAuthenticated ? 1 : 0.5}
                    >
                      <Text color="white" fontWeight="700">
                        {isAuthenticated ? "Send SOL" : "Connect to Send"}
                      </Text>
                    </ActionButton>
                  </YStack>
                </GlassCard>

                {/* Wallets Section */}
                <YStack gap="$3">
                  <XStack justifyContent="space-between" alignItems="baseline">
                    <H6
                      color="$color"
                      opacity={0.6}
                      textTransform="uppercase"
                      letterSpacing={1}
                    >
                      Linked Wallets
                    </H6>
                  </XStack>

                  {loading ? (
                    <Spinner size="large" color="$colorFocus" />
                  ) : (
                    <GlassCard bordered padded>
                      <YStack gap="$2">
                        <Text
                          color="$color"
                          opacity={0.6}
                          fontSize={12}
                          textTransform="uppercase"
                          letterSpacing={1}
                        >
                          {isAuthenticated ? "Connected Wallet" : "No wallet linked"}
                        </Text>
                        <XStack justifyContent="space-between" alignItems="center">
                          <YStack gap="$1">
                            <Text color="white" fontWeight="700" fontSize={16}>
                              {account
                                ? `${account.address.slice(0, 4)}...${account.address.slice(-4)}`
                                : "Connect to load"}
                            </Text>
                            <Text color="$color" opacity={0.5} fontSize={12}>
                              {account?.label ?? (isAuthenticated ? "Mobile Wallet" : "Awaiting connection")}
                            </Text>
                          </YStack>
                          <YStack alignItems="flex-end">
                            <Text color="white" fontWeight="700" fontSize={16}>
                              {solBalance !== null ? `${solBalance.toFixed(3)} SOL` : "—"}
                            </Text>
                            <Text color="$color" opacity={0.5} fontSize={12}>
                              {solBalanceValueUsd !== null ? formatUsd(solBalanceValueUsd) : "Live"}
                            </Text>
                          </YStack>
                        </XStack>
                      </YStack>
                    </GlassCard>
                  )}
                </YStack>

                {/* Session Keys Section */}
                <YStack gap="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <H6
                      color="$color"
                      opacity={0.6}
                      textTransform="uppercase"
                      letterSpacing={1}
                    >
                      Session Keys
                    </H6>
                  </XStack>

                  <ActionButton onPress={handleIssueSessionKey}>
                    <Text color="white" fontWeight="700">
                      Issue New Session Key
                    </Text>
                  </ActionButton>

                  {sessions.map((session) => (
                    <GlassCard key={session.id} bordered padded>
                      <YStack gap="$3">
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <YStack>
                            <Text color="white" fontWeight="700" fontSize={15}>
                              {session.metadata?.device ?? "Unknown Device"}
                            </Text>
                            <Text
                              color="$color"
                              opacity={0.5}
                              fontSize={12}
                              marginTop="$1"
                            >
                              Expires{" "}
                              {new Date(session.expiresAt).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </Text>
                          </YStack>
                          <YStack
                            backgroundColor={
                              session.status === "active"
                                ? "rgba(0, 255, 179, 0.1)"
                                : "rgba(255, 255, 255, 0.05)"
                            }
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            borderRadius="$2"
                            borderWidth={1}
                            borderColor={
                              session.status === "active"
                                ? "rgba(0, 255, 179, 0.3)"
                                : "transparent"
                            }
                          >
                            <Text
                              color={
                                session.status === "active"
                                  ? "$accentColor"
                                  : "$color"
                              }
                              opacity={session.status === "active" ? 1 : 0.4}
                              fontSize={10}
                              fontWeight="800"
                              textTransform="uppercase"
                            >
                              {session.status}
                            </Text>
                          </YStack>
                        </XStack>

                        <Separator borderColor="rgba(255,255,255,0.05)" />

                        <XStack gap="$2" flexWrap="wrap">
                          {session.scopes.map((scope, idx) => (
                            <YStack
                              key={idx}
                              backgroundColor="rgba(142, 164, 255, 0.1)"
                              borderRadius="$1"
                              paddingHorizontal="$2"
                              paddingVertical={4}
                            >
                              <Text
                                color="$colorFocus"
                                fontSize={11}
                                fontWeight="600"
                              >
                                {scope.name}{" "}
                                {scope.maxUsd ? `≤ $${scope.maxUsd}` : ""}
                              </Text>
                            </YStack>
                          ))}
                        </XStack>

                        {session.status === "active" && (
                          <Button
                            size="$3"
                            variant="outlined"
                            borderColor="rgba(255,255,255,0.2)"
                            marginTop="$2"
                            onPress={() => handleRevokeSessionKey(session.id)}
                            pressStyle={{
                              backgroundColor: "rgba(255,255,255,0.05)",
                            }}
                          >
                            <Text color="$color" opacity={0.7} fontSize={12}>
                              Revoke Access
                            </Text>
                          </Button>
                        )}
                      </YStack>
                    </GlassCard>
                  ))}
                </YStack>
              </YStack>
            </ScrollView>
            <Sheet
              open={sendSheetOpen}
              onOpenChange={setSendSheetOpen}
              snapPoints={[80]}
              snapPointsMode="percent"
              dismissOnSnapToBottom
            >
              <Sheet.Overlay
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
                animation="lazy"
              />
              <Sheet.Handle />
              <Sheet.Frame
                backgroundColor="$backgroundStrong"
                borderTopLeftRadius="$6"
                borderTopRightRadius="$6"
                padding="$4"
                gap="$4"
              >
                <H6
                  color="$colorFocus"
                  textTransform="uppercase"
                  letterSpacing={1}
                >
                  Send SOL
                </H6>
                <Input
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  placeholder="Recipient address"
                  backgroundColor="rgba(255,255,255,0.05)"
                  color="white"
                />
                <Input
                  value={amountToSend}
                  onChangeText={setAmountToSend}
                  keyboardType="decimal-pad"
                  placeholder="Amount (SOL)"
                  backgroundColor="rgba(255,255,255,0.05)"
                  color="white"
                />
                {sendFeedback && (
                  <Text
                    color={
                      sendFeedback.type === "success"
                        ? "$accentColor"
                        : "$error"
                    }
                    fontSize={12}
                  >
                    {sendFeedback.message}
                  </Text>
                )}
                <ActionButton
                  disabled={!isAuthenticated || sending}
                  opacity={!isAuthenticated ? 0.5 : 1}
                  onPress={handleSendSol}
                >
                  <Text color="white" fontWeight="700">
                    {sending ? "Sending..." : "Send SOL"}
                  </Text>
                </ActionButton>
              </Sheet.Frame>
            </Sheet>
          </SafeAreaView>
        </Theme>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}
