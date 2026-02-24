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
import { useWalletStore } from "../store/walletStore";
import PortfolioHeader from "../components/common/PortfolioHeader";
import ModernPortfolioLineChart from "../components/analytics/ModernPortfolioLineChart";
import { AssetAllocationPieChart } from "../components/analytics/AssetAllocationPieChart";
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
import {
  calculatePortfolioChangePercent,
  filterHistoricalDataByRange,
} from "../utils/portfolioPerformance";

// Helper function to get top tokens from detailed balances
const getTopTokens = (
  detailedData: Record<
    string,
    {
      tokens?: Array<{
        symbol?: string;
        mint: string;
        usdValue: number;
      }>;
    }
  >,
  walletAddress?: string,
): Array<{ symbol: string; valueUSD: number }> => {
  if (!walletAddress || !detailedData[walletAddress]?.tokens) {
    return [];
  }

  return detailedData[walletAddress].tokens
    .map((token) => ({
      symbol: token.symbol || token.mint.slice(0, 6),
      valueUSD: token.usdValue,
    }))
    .sort((a, b) => b.valueUSD - a.valueUSD)
    .slice(0, 5);
};

const PortfolioScreen: React.FC = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendSol, refreshBalance, detailedBalances } = useSolana();
  const { linkedWallets, activeWallet, primaryWalletAddress } =
    useWalletStore();
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

  // Initialize chart data from real historical data
  const initialHistoryData = activeWallet
    ? getHistoricalBalances(activeWallet.address)
    : [];
  const [chartData, setChartData] = useState(
    filterHistoricalDataByRange(initialHistoryData, 7),
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

  // Update chart data and portfolio change percentage when active wallet changes
  useEffect(() => {
    if (activeWallet) {
      const historyData = getHistoricalBalances(activeWallet.address);
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
  }, [activeWallet, timeRange, getHistoricalBalances, activeWalletUsdValue]);

  // Handle time range change with animation
  const handleTimeRangeChange = (range: "1D" | "7D" | "30D") => {
    setTimeRange(range);
    setLoading(true);

    const updateChartData = () => {
      if (activeWallet) {
        const historyData = getHistoricalBalances(activeWallet.address);
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
              <ModernPortfolioLineChart history={chartData} />
            )}
          </Animated.View>
        </View>

        {/* Asset Allocation Pie Chart */}
        <View style={styles.section}>
          <AssetAllocationPieChart
            tokens={getTopTokens(detailedBalances, activeWallet?.address)}
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
