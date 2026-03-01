import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../theme/ThemeContext";
import { useSolana } from "../context/SolanaContext";
import { fetchAssets } from "../services";
// runtime network is read from `useSolanaStore` in this screen
import { filterAssets } from "../utils";
import { useWalletStore } from "../store/walletStore";
import { useSolanaStore } from "../store/solanaStore";
import PortfolioHeader from "../components/common/PortfolioHeader";
import NetworkSwitcher from "../components/common/NetworkSwitcher";
import {
  GiftedLineChart,
  AssetAllocationPieChart,
} from "../components/analytics";
import WalletWidget from "../components/wallet/WalletWidget";
import TimeRangeSelector from "../components/portfolio/TimeRangeSelector";
import SendModal from "../components/portfolio/SendModal";
import ReceiveModal from "../components/portfolio/ReceiveModal";
import { toast } from "../components/common/ErrorToast";
import * as Haptics from "expo-haptics";
import { useWalletHistoricalStore } from "../store/walletStore";
import {
  TIME_RANGE_OPTIONS,
  ANIMATION_CONFIG,
  UI_CONFIG,
  CHART_CONFIG,
} from "../config/appConfig";
import type { TokenAsset } from "../types";
import {
  calculatePortfolioChangePercent,
  filterHistoricalDataByRange,
} from "../utils";

// Helper function to map fetched assets to chart-ready tokens
const getAssetAllocationTokens = (
  assets: TokenAsset[],
): Array<{ symbol: string; usdValue: number }> =>
  assets.map((asset) => ({
    symbol: asset.symbol,
    usdValue: asset.usdValue,
  }));

const PortfolioScreen: React.FC = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendSol, refreshBalance, detailedBalances } = useSolana();
  const { linkedWallets, activeWallet, primaryWalletAddress } =
    useWalletStore();
  const { network } = useSolanaStore();
  const getHistoricalBalances = useWalletHistoricalStore(
    (state) => state.getHistoricalBalances,
  );

  // Portfolio state
  const [timeRange, setTimeRange] = useState<"1D" | "7D" | "30D">(
    TIME_RANGE_OPTIONS.DEFAULT,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [portfolioChangePercent, setPortfolioChangePercent] = useState(0);
  const [allocationAssets, setAllocationAssets] = useState<TokenAsset[]>([]);

  // Initialize chart data from real historical data
  const initialHistoryData = activeWallet
    ? getHistoricalBalances(network, activeWallet.address)
    : [];
  const [chartData, setChartData] = useState(
    filterHistoricalDataByRange(
      initialHistoryData,
      parseInt(TIME_RANGE_OPTIONS.DEFAULT),
    ),
  );

  // Modal states
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);

  // Animated values
  const chartOpacity = useSharedValue(1);

  // Balance data
  const activeWalletBalance = activeWallet
    ? detailedBalances[activeWallet.address]?.balance || 0
    : 0;

  const activeWalletUsdValue = activeWallet
    ? detailedBalances[activeWallet.address]?.usdValue || 0
    : 0;

  const isPrimaryWalletSet = Boolean(primaryWalletAddress);
  const isActivePrimary =
    !!activeWallet && activeWallet.address === primaryWalletAddress;

  useEffect(() => {
    let cancelled = false;
    const address = activeWallet?.address;
    if (!address) {
      setAllocationAssets([]);
      return () => {
        cancelled = true;
      };
    }

    // Use the runtime `network` from solana store so switching between
    // mainnet/devnet triggers a refetch of allocation assets. Convert to
    // ChainId expected by fetchAssets (e.g. "solana:devnet").
    const chainId = `solana:${network}` as any;
    fetchAssets(chainId, address)
      .then((assets) => {
        if (!cancelled) {
          const { verified } = filterAssets(assets, {
            liquidityThresholdUsd: 0,
          });
          setAllocationAssets(verified);
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch asset allocation assets", error);
        if (!cancelled) {
          setAllocationAssets([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeWallet?.address, network]);

  // Update chart data and portfolio change percentage when active wallet changes
  useEffect(() => {
    if (activeWallet) {
      const historyData = getHistoricalBalances(network, activeWallet.address);
      const days = parseInt(timeRange);
      const filteredData = filterHistoricalDataByRange(historyData, days);
      setChartData(filteredData);

      // Calculate portfolio change percentage
      const changePercent = calculatePortfolioChangePercent(
        activeWalletUsdValue,
        filteredData,
        timeRange,
      );
      setPortfolioChangePercent(changePercent);
    }
  }, [
    activeWallet,
    timeRange,
    getHistoricalBalances,
    activeWalletUsdValue,
    network,
  ]);

  // Handle time range change with animation
  const handleTimeRangeChange = (range: "1D" | "7D" | "30D") => {
    setTimeRange(range);
    setLoading(true);

    const updateChartData = () => {
      if (activeWallet) {
        const historyData = getHistoricalBalances(
          network,
          activeWallet.address,
        );
        const days = parseInt(range);
        const filteredData = filterHistoricalDataByRange(historyData, days);
        setChartData(filteredData);

        // Calculate portfolio change percentage
        const changePercent = calculatePortfolioChangePercent(
          activeWalletUsdValue,
          filteredData,
          range,
        );
        setPortfolioChangePercent(changePercent);
      }
      setLoading(false);
      chartOpacity.value = withTiming(1, {
        duration: ANIMATION_CONFIG.TIMING.MEDIUM,
        easing: Easing.inOut(Easing.ease),
      });
    };

    chartOpacity.value = withTiming(
      0,
      {
        duration: ANIMATION_CONFIG.TIMING.SHORT,
        easing: Easing.inOut(Easing.ease),
      },
      () => {
        setTimeout(() => {
          runOnJS(updateChartData)();
        }, ANIMATION_CONFIG.TIMING.MEDIUM);
      },
    );
  };

  // Handle screen refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshPromises = linkedWallets.map((wallet: any) =>
        refreshBalance(wallet.address).catch((err: any) => {
          console.warn(`Balance refresh failed for ${wallet.address}`, err);
        }),
      );

      await Promise.all(refreshPromises);
    } catch (err: any) {
      console.warn("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [linkedWallets, refreshBalance]);

  // Handle receiving (show QR code and address)
  const handleReceive = useCallback(() => {
    if (!activeWallet) {
      Alert.alert(
        "No wallet connected",
        "Please connect a wallet first to receive SOL.",
      );
      return;
    }
    setReceiveModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [activeWallet]);

  // Animated chart style
  const chartAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: chartOpacity.value,
      transform: [
        {
          scale: withSpring(chartOpacity.value, ANIMATION_CONFIG.SPRING),
        },
      ],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Wallet Widget */}
        <WalletWidget
          onSendPress={() => setSendModalVisible(true)}
          onReceivePress={handleReceive}
        />

        {/* Network Switcher */}
        <NetworkSwitcher />

        {/* Portfolio Header */}
        <View style={styles.section}>
          <PortfolioHeader
            totalValueUSD={activeWalletUsdValue}
            change24hPercent={portfolioChangePercent}
          />
        </View>

        {/* Time Range Selector */}
        <TimeRangeSelector
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
        />

        {/* Portfolio Line Chart */}
        <View style={styles.section}>
          <Animated.View style={chartAnimatedStyle}>
            {loading ? (
              <View
                style={[
                  styles.loadingContainer,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : (
              <GiftedLineChart history={chartData} />
            )}
          </Animated.View>
        </View>

        {/* Asset Allocation Pie Chart */}
        <View style={styles.section}>
          <AssetAllocationPieChart
            tokens={getAssetAllocationTokens(allocationAssets)}
          />
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* Send Modal */}
      <SendModal
        visible={sendModalVisible}
        onClose={() => setSendModalVisible(false)}
      />

      {/* Receive Modal */}
      <ReceiveModal
        visible={receiveModalVisible}
        onClose={() => setReceiveModalVisible(false)}
        walletAddress={activeWallet?.address}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: UI_CONFIG.SPACING.MD,
    paddingVertical: UI_CONFIG.SPACING.MD,
    paddingBottom: UI_CONFIG.SPACING.XL,
  },
  section: {
    marginBottom: 28,
  },
  loadingContainer: {
    height: CHART_CONFIG.CHART_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: UI_CONFIG.BORDER_RADIUS.XL,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    ...UI_CONFIG.SHADOW.MEDIUM,
  },
  bottomSpace: {
    height: UI_CONFIG.BOTTOM_SPACE,
  },
});

export default PortfolioScreen;
