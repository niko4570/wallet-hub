import { AggregatedPortfolio, SessionKey } from "@wallethub/contracts";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
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
  Paragraph,
  Separator,
  Spacer,
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

  const [portfolio, setPortfolio] = useState<AggregatedPortfolio | null>(null);
  const [sessions, setSessions] = useState<SessionKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, disconnect, sendSol, account, isAuthenticated } =
    useSolana();
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

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [portfolioResponse, sessionResponse] = await Promise.all([
        fetchJson<AggregatedPortfolio>("/wallets"),
        fetchJson<SessionKey[]>("/session"),
      ]);
      setPortfolio(portfolioResponse);
      setSessions(sessionResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const handleIssueSessionKey = useCallback(async () => {
    if (!portfolio?.wallets.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const primaryWallet = portfolio.wallets[0];
    await fetchJson<SessionKey>("/session/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: primaryWallet.address,
        devicePublicKey: "demo-device-public-key",
        expiresInMinutes: 60,
        scopes: [{ name: "transfer", maxUsd: 500 }],
        metadata: { device: "Saga Pro devkit" },
      }),
    });
    await loadData();
  }, [portfolio, loadData]);

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

  const totalWalletsValue = useMemo(
    () => portfolio?.totalUsdValue ?? 0,
    [portfolio],
  );

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
                  <YStack gap="$1">
                    <H6
                      color="$colorFocus"
                      textTransform="uppercase"
                      letterSpacing={2}
                      fontSize={11}
                      opacity={0.8}
                    >
                      Total Portfolio Value
                    </H6>
                    <H3
                      fontSize={42}
                      fontWeight="900"
                      letterSpacing={-1}
                      lineHeight={48}
                    >
                      {formatUsd(totalWalletsValue)}
                    </H3>
                    <XStack gap="$2" alignItems="center" marginTop="$2">
                      <YStack
                        backgroundColor="rgba(0, 255, 179, 0.15)"
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$2"
                      >
                        <Text
                          color="$accentColor"
                          fontSize={12}
                          fontWeight="700"
                        >
                          +{portfolio?.change24hPercent ?? 0}%
                        </Text>
                      </YStack>
                      <Text color="$color" opacity={0.5} fontSize={13}>
                        vs 24h
                      </Text>
                    </XStack>
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

                  {loading && !portfolio ? (
                    <Spinner size="large" color="$colorFocus" />
                  ) : (
                    portfolio?.wallets.map((wallet) => (
                      <GlassCard key={wallet.address} bordered padded>
                        <XStack
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <YStack gap="$1">
                            <Text color="white" fontWeight="700" fontSize={16}>
                              {wallet.label ?? wallet.address.slice(0, 6)}
                            </Text>
                            <Text color="$color" opacity={0.5} fontSize={12}>
                              {wallet.provider.toUpperCase()}
                            </Text>
                          </YStack>
                          <YStack alignItems="flex-end" gap="$1">
                            <Text color="white" fontWeight="700" fontSize={16}>
                              {formatUsd(wallet.totalUsdValue)}
                            </Text>
                            <Text color="$color" opacity={0.5} fontSize={12}>
                              {wallet.shareOfPortfolio}% share
                            </Text>
                          </YStack>
                        </XStack>
                      </GlassCard>
                    ))
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
