import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import WebView from "react-native-webview";
import {
  EXTERNAL_EXPLORE_ALLOWED_HOSTS,
  EXTERNAL_EXPLORE_URL,
} from "../config/env";
import { telemetryService } from "../services/telemetryService";

const ExploreScreen = () => {
  const [webViewKey, setWebViewKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState(EXTERNAL_EXPLORE_URL);

  const allowedHosts = useMemo(
    () => new Set(EXTERNAL_EXPLORE_ALLOWED_HOSTS),
    [],
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

  useFocusEffect(
    useCallback(() => {
      recordTelemetry("explore_screen_focus");
      return () => {
        recordTelemetry("explore_screen_blur");
      };
    }, [recordTelemetry]),
  );

  const isHostAllowed = useCallback(
    (url: string) => {
      try {
        const host = new URL(url).host;
        if (allowedHosts.has(host)) {
          return true;
        }
        // allow subdomains of any host in the allowlist
        return Array.from(allowedHosts).some((allowedHost) =>
          host.endsWith(`.${allowedHost}`),
        );
      } catch (_error) {
        return false;
      }
    },
    [allowedHosts],
  );

  const handleReload = useCallback(() => {
    setErrorMessage(null);
    setIsLoading(true);
    setWebViewKey((prev) => prev + 1);
    recordTelemetry("explore_reload");
  }, [recordTelemetry]);

  const handleOpenExternal = useCallback(async () => {
    recordTelemetry("explore_open_external");
    try {
      await Linking.openURL(EXTERNAL_EXPLORE_URL);
    } catch (error) {
      Alert.alert("Unable to open browser", "Please try again later.");
      console.warn("Open external explore failed", error);
    }
  }, [recordTelemetry]);

  const handleBlockedNavigation = useCallback(
    async (targetUrl: string) => {
      recordTelemetry("explore_navigation_blocked", { targetUrl });
      try {
        await Linking.openURL(targetUrl);
      } catch (error) {
        console.warn("Failed to open blocked URL externally", error);
        Alert.alert("Navigation blocked", "Unable to open the requested link.");
      }
    },
    [recordTelemetry],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: any) => {
      if (!isHostAllowed(request.url)) {
        handleBlockedNavigation(request.url);
        return false;
      }
      setCurrentUrl(request.url);
      return true;
    },
    [handleBlockedNavigation, isHostAllowed],
  );

  const onLoadStart = useCallback(
    (event: any) => {
      setIsLoading(true);
      setErrorMessage(null);
      recordTelemetry("explore_load_start", { url: event.nativeEvent.url });
    },
    [recordTelemetry],
  );

  const onLoadEnd = useCallback(
    (event: any) => {
      setIsLoading(false);
      setErrorMessage(null);
      recordTelemetry("explore_load_success", { url: event.nativeEvent.url });
    },
    [recordTelemetry],
  );

  const onError = useCallback(
    (event: any) => {
      const message =
        event.nativeEvent.description || "Unable to load Explore view.";
      setIsLoading(false);
      setErrorMessage(message);
      recordTelemetry("explore_load_error", {
        url: event.nativeEvent.url,
        message,
      });
    },
    [recordTelemetry],
  );

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroTextGroup}>
          <Text style={styles.heroTitle}>Explore Solana dApps</Text>
          <Text style={styles.heroSubtitle}>
            Powered by an external Explore experience so you always see the most
            up-to-date catalog.
          </Text>
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity
            onPress={handleReload}
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
        {errorMessage ? (
          <View style={styles.errorState}>
            <Feather name="alert-triangle" size={28} color="#F97316" />
            <Text style={styles.errorTitle}>Connection issue</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={handleReload}
              style={styles.retryButton}
              activeOpacity={0.9}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <WebView
              key={webViewKey}
              source={{ uri: EXTERNAL_EXPLORE_URL }}
              style={styles.webview}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
              onLoadStart={onLoadStart}
              onLoadEnd={onLoadEnd}
              onError={onError}
            />
            {isLoading && (
              <View style={styles.webviewOverlay}>
                <ActivityIndicator color="#C7B5FF" />
                <Text style={styles.overlayText}>Loading Explore...</Text>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Safety guardrails</Text>
        <Text style={styles.footerText}>
          WalletHub only loads Explore content from approved hosts:
        </Text>
        <View style={styles.hostList}>
          {Array.from(allowedHosts).map((host) => (
            <View key={host} style={styles.hostPill}>
              <Text style={styles.hostPillText}>{host}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footerText}>
          Tapping out-of-scope links will open your system browser instead.
        </Text>
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
});

export default ExploreScreen;
