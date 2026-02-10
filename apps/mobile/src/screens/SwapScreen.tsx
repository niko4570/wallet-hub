import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useSolana } from "../hooks/useSolana";
import {
  JUPITER_PLUGIN_URL,
  JUPITER_PLUGIN_ALLOWED_HOSTS,
} from "../config/env";
import { telemetryService } from "../services/telemetryService";

const SwapScreen = () => {
  const { activeWallet } = useSolana();
  const [swapLoading, setSwapLoading] = useState(true);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(JUPITER_PLUGIN_URL);
  const swapWebViewRef = useRef<WebView>(null);

  const normalizedPluginHosts = useMemo(
    () =>
      JUPITER_PLUGIN_ALLOWED_HOSTS.map((host) =>
        host.trim().toLowerCase(),
      ).filter(Boolean),
    [JUPITER_PLUGIN_ALLOWED_HOSTS],
  );

  const recordTelemetry = useCallback(
    (event: string, data?: Record<string, unknown>) => {
      telemetryService
        .recordExploreEvent({
          event,
          url: currentUrl,
          metadata: data,
        })
        .catch(() => {
          /* ignored */
        });
    },
    [currentUrl],
  );

  const handleShouldLoadPlugin = useCallback(
    (request: { url: string }) => {
      const { url } = request;
      if (!url) {
        return false;
      }
      try {
        const host = new URL(url).host.toLowerCase();
        if (normalizedPluginHosts.includes(host)) {
          setCurrentUrl(url);
          return true;
        }
      } catch (error) {
        console.warn("Invalid URL in swap WebView", error);
      }
      Linking.openURL(url).catch((err) => {
        console.warn("Failed to open external URL", err);
      });
      return false;
    },
    [normalizedPluginHosts],
  );

  const handleReloadSwap = useCallback(() => {
    setSwapError(null);
    setSwapLoading(true);
    swapWebViewRef.current?.reload();
    recordTelemetry("swap_reload");
  }, [recordTelemetry]);

  const handleOpenExternal = useCallback(async () => {
    recordTelemetry("swap_open_external");
    try {
      await Linking.openURL(JUPITER_PLUGIN_URL);
    } catch (error) {
      Alert.alert("Unable to open browser", "Please try again later.");
      console.warn("Open external swap failed", error);
    }
  }, [recordTelemetry]);

  const onLoadStart = useCallback(
    (event: any) => {
      setSwapLoading(true);
      setSwapError(null);
      recordTelemetry("swap_load_start", { url: event.nativeEvent.url });
    },
    [recordTelemetry],
  );

  const onLoadEnd = useCallback(
    (event: any) => {
      setSwapLoading(false);
      setSwapError(null);
      recordTelemetry("swap_load_success", { url: event.nativeEvent.url });
    },
    [recordTelemetry],
  );

  const onError = useCallback(
    (event: any) => {
      const message =
        event.nativeEvent.description || "Unable to load Swap view.";
      setSwapLoading(false);
      setSwapError(message);
      recordTelemetry("swap_load_error", {
        url: event.nativeEvent.url,
        message,
      });
    },
    [recordTelemetry],
  );

  if (!activeWallet) {
    return (
      <View style={styles.container}>
        <View style={styles.noWalletState}>
          <Feather
            name="credit-card"
            size={48}
            color="rgba(255, 255, 255, 0.3)"
          />
          <Text style={styles.noWalletTitle}>No Wallet Connected</Text>
          <Text style={styles.noWalletDescription}>
            Connect a wallet to use the swap feature
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroTextGroup}>
          <Text style={styles.heroTitle}>Swap Tokens</Text>
          <Text style={styles.heroSubtitle}>
            Powered by Jupiter Aggregator for best rates and minimal slippage
          </Text>
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity
            onPress={handleReloadSwap}
            style={styles.heroButton}
            activeOpacity={0.85}
          >
            <Feather name="refresh-ccw" size={16} color="#0B1221" />
            <Text style={styles.heroButtonText}>Reload</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenExternal}
            style={[styles.heroButton, styles.heroButtonGhost]}
            activeOpacity={0.85}
          >
            <Feather name="external-link" size={16} color="#9B8CFF" />
            <Text style={styles.heroButtonGhostText}>Open in Browser</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.webviewCard}>
        {swapError ? (
          <View style={styles.errorState}>
            <Feather name="alert-triangle" size={28} color="#F97316" />
            <Text style={styles.errorTitle}>Connection issue</Text>
            <Text style={styles.errorMessage}>{swapError}</Text>
            <TouchableOpacity
              onPress={handleReloadSwap}
              style={styles.retryButton}
              activeOpacity={0.9}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <WebView
              ref={swapWebViewRef}
              source={{ uri: JUPITER_PLUGIN_URL }}
              style={styles.webview}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={handleShouldLoadPlugin}
              onLoadStart={onLoadStart}
              onLoadEnd={onLoadEnd}
              onError={onError}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              scrollEnabled
            />
            {swapLoading && (
              <View style={styles.webviewOverlay}>
                <ActivityIndicator color="#C7B5FF" />
                <Text style={styles.overlayText}>Loading Swap...</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Powered by Jupiter</Text>
        <Text style={styles.footerText}>
          Best rates and routes across all Solana DEXes
        </Text>
        <View style={styles.hostList}>
          {normalizedPluginHosts.map((host) => (
            <View key={host} style={styles.hostPill}>
              <Text style={styles.hostPillText}>{host}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050814",
    padding: 24,
    gap: 18,
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroTextGroup: {
    marginBottom: 16,
    gap: 8,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
  },
  heroButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9B8CFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flex: 1,
  },
  heroButtonText: {
    color: "#0B1221",
    fontWeight: "800",
  },
  heroButtonGhost: {
    backgroundColor: "rgba(155,140,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(155,140,255,0.4)",
  },
  heroButtonGhostText: {
    color: "#9B8CFF",
    fontWeight: "700",
  },
  webviewCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0B1221",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  webviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,20,0.85)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  overlayText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  errorMessage: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#9B8CFF",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#0B1221",
    fontWeight: "700",
  },
  footer: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  footerTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  footerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    lineHeight: 18,
  },
  hostList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hostPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(155,140,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(155,140,255,0.35)",
  },
  hostPillText: {
    color: "#C7B5FF",
    fontWeight: "600",
    fontSize: 12,
  },
  noWalletState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  noWalletTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  noWalletDescription: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: 16,
  },
});

export default SwapScreen;
