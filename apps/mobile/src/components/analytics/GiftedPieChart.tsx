/**
 * GiftedPieChart Component
 *
 * A donut chart component for displaying asset allocation using react-native-gifted-charts.
 * Features interactive focus on press, animated transitions, and customizable legend.
 *
 * @example
 * ```tsx
 * <GiftedPieChart
 *   tokens={[{ symbol: 'SOL', usdValue: 100 }]}
 *   showLegend={true}
 * />
 * ```
 */

import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import {
  buildPortfolioAllocation,
  buildCategoryAllocation,
  buildCategoryBreakdown,
  classifyPortfolioCategory,
  calculateConcentrationMetrics,
} from "../../utils";
import type { PortfolioCategoryName } from "../../utils";
import { CHART_CONFIG } from "../../config/appConfig";
import { useSolanaStore } from "../../store/solanaStore";

/**
 * Token interface representing a cryptocurrency or digital asset
 */
interface Token {
  /** Asset symbol (e.g., 'SOL', 'USDC') */
  symbol: string;
  /** USD value of the asset holding */
  usdValue: number;
  /** Optional mint address */
  mint?: string;
  /** Optional token name */
  name?: string;
}

type ViewMode = "asset" | "category";

/**
 * ChartDataPoint interface for pie chart rendering
 */
interface ChartDataPoint {
  /** Numerical value for chart proportion */
  value: number;
  /** Asset symbol */
  symbol: string;
  /** USD value of the asset */
  usdValue: number;
  /** Percentage of total portfolio (0-100) */
  percentage: number;
  /** Color code for the slice */
  color: string;
  /** Text label to display */
  text: string;
  /** Group key for drilldown */
  groupKey: string;
}

/**
 * Props for GiftedPieChart component
 */
interface GiftedPieChartProps {
  /** Array of token assets to display */
  tokens: Token[];
  /** Loading state indicator */
  loading?: boolean;
  /** Error message to display */
  error?: string;
  /** Show legend below chart (default: true) */
  showLegend?: boolean;
}

// Color constants for consistent theming
const BACKGROUND = "#0B0B0F";
const TEXT_PRIMARY = "#F5F5F7";
const TEXT_SECONDARY = "rgba(245, 245, 247, 0.6)";

/**
 * Color palette for chart slices
 * - primaryGradient: Main slice with gradient effect
 * - secondary: Second largest slice
 * - accent: Third slice
 * - muted: Remaining slices
 */
const COLORS = {
  primaryGradient: ["#7C3AED", "#A78BFA"],
  secondary: "#2563EB",
  accent: "#0EA5E9",
  muted: "#1F1F26",
};

// Alternate palette for devnet (lighter, lower-contrast for test/dev visuals)
const COLORS_DEV = {
  primaryGradient: ["#06B6D4", "#7DD3FC"],
  secondary: "#34D399",
  accent: "#60A5FA",
  muted: "#111214",
};

/**
 * Formats a USD value with proper localization and rounding
 * @param value - The numeric value to format
 * @returns Formatted USD string (e.g., "$1,234")
 */
const formatUsd = (value: number) => {
  const rounded = Math.round(value);
  if (Number.isNaN(rounded)) {
    return "$0";
  }
  try {
    return `$${rounded.toLocaleString()}`;
  } catch {
    return `$${rounded}`;
  }
};

/**
 * Main GiftedPieChart component
 * Renders a donut chart showing asset allocation with interactive features
 */
const GiftedPieChart: React.FC<GiftedPieChartProps> = ({
  tokens,
  loading = false,
  error,
  showLegend = true,
}) => {
  // Track the currently focused slice index
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<ViewMode>("asset");
  const [selectedCategory, setSelectedCategory] =
    useState<PortfolioCategoryName | null>(null);

  // Calculate total portfolio value and asset allocation using utility function
  const network = useSolanaStore((s) => s.network);

  const { totalUsd, allocation } = useMemo(() => {
    const isDevnet = network === "devnet";
    const minValueUsd = isDevnet
      ? Math.max(1, CHART_CONFIG.ASSET_ALLOCATION_MIN_VALUE_USD)
      : CHART_CONFIG.ASSET_ALLOCATION_MIN_VALUE_USD;
    return buildPortfolioAllocation(tokens, minValueUsd);
  }, [tokens, network]);

  // Limit displayed slices to maximum configured amount, sorted by value descending
  const slices = useMemo(() => {
    if (allocation.length === 0) {
      return [] as typeof allocation;
    }

    const isDevnet = network === "devnet";
    const maxSlices = isDevnet
      ? Math.max(1, Math.min(5, CHART_CONFIG.ASSET_ALLOCATION_MAX_SLICES))
      : Math.max(1, CHART_CONFIG.ASSET_ALLOCATION_MAX_SLICES);
    const sorted = [...allocation].sort((a, b) => b.usdValue - a.usdValue);
    return sorted.slice(0, maxSlices);
  }, [allocation, network]);

  const categorySlices = useMemo(() => {
    return buildCategoryAllocation(allocation, totalUsd);
  }, [allocation, totalUsd]);

  const selectedSlices = viewMode === "category" ? categorySlices : slices;

  // Transform allocation data into chart-ready format with colors and percentages
  const chartData: ChartDataPoint[] = useMemo(() => {
    const isDevnet = network === "devnet";
    const palette = isDevnet ? COLORS_DEV : COLORS;

    return selectedSlices.map((slice, index) => {
      // Assign colors based on slice importance (largest to smallest)
      let color = palette.muted;
      if (index === 0) {
        color = palette.primaryGradient[0];
      } else if (index === 1) {
        color = palette.secondary;
      } else if (index === 2) {
        color = palette.accent;
      }

      const percentage = Math.round(slice.percentage * 100);

      return {
        value: slice.usdValue,
        symbol: slice.symbol,
        usdValue: slice.usdValue,
        percentage,
        color,
        text: `${percentage}%`,
        groupKey:
          viewMode === "category"
            ? slice.symbol
            : classifyPortfolioCategory(slice.symbol),
      };
    });
  }, [selectedSlices, network, viewMode]);

  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(allocation),
    [allocation],
  );

  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) {
      return [] as Array<{
        symbol: string;
        usdValue: number;
        percentage: number;
      }>;
    }

    return (categoryBreakdown.get(selectedCategory) ?? [])
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, 6);
  }, [categoryBreakdown, selectedCategory]);

  const concentrationMetrics = useMemo(
    () => calculateConcentrationMetrics(allocation),
    [allocation],
  );

  // Handle slice press event to update focus state
  const handlePress = useCallback(
    (item: any, index: number) => {
      setFocusedIndex(index);

      if (viewMode === "category") {
        const group = item?.groupKey as PortfolioCategoryName | undefined;
        setSelectedCategory(group ?? null);
        return;
      }

      setSelectedCategory(
        classifyPortfolioCategory(String(item?.symbol ?? "")),
      );
    },
    [viewMode],
  );

  const switchViewMode = useCallback((nextMode: ViewMode) => {
    setViewMode(nextMode);
    setFocusedIndex(-1);
    setSelectedCategory(null);
  }, []);

  const handleLegendPress = useCallback(
    (entry: ChartDataPoint, index: number) => {
      setFocusedIndex(index);
      if (viewMode === "category") {
        setSelectedCategory(entry.groupKey as PortfolioCategoryName);
      } else {
        setSelectedCategory(classifyPortfolioCategory(entry.symbol));
      }
    },
    [viewMode],
  );

  // Render loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>Loading asset allocation...</Text>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>Error loading asset allocation</Text>
        <Text style={styles.stateSubtext}>{error}</Text>
      </View>
    );
  }

  // Render empty state when no data available
  if (selectedSlices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>No assets to display</Text>
      </View>
    );
  }

  // Calculate responsive chart dimensions
  const { width: screenWidth } = Dimensions.get("window");
  const chartSize = Math.min(screenWidth * 0.64, 260);
  const radius = chartSize / 2 - 20;

  return (
    <View style={styles.container}>
      <View style={styles.chartWrapper}>
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[
              styles.modeSwitchButton,
              viewMode === "asset" && styles.modeSwitchButtonActive,
            ]}
            onPress={() => switchViewMode("asset")}
          >
            <View style={styles.modeSwitchContent}>
              <Feather
                name="pie-chart"
                size={12}
                color={viewMode === "asset" ? TEXT_PRIMARY : TEXT_SECONDARY}
                style={styles.modeSwitchIcon}
              />
              <Text
                style={[
                  styles.modeSwitchText,
                  viewMode === "asset" && styles.modeSwitchTextActive,
                ]}
              >
                Assets
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeSwitchButton,
              viewMode === "category" && styles.modeSwitchButtonActive,
            ]}
            onPress={() => switchViewMode("category")}
          >
            <View style={styles.modeSwitchContent}>
              <Feather
                name="grid"
                size={12}
                color={viewMode === "category" ? TEXT_PRIMARY : TEXT_SECONDARY}
                style={styles.modeSwitchIcon}
              />
              <Text
                style={[
                  styles.modeSwitchText,
                  viewMode === "category" && styles.modeSwitchTextActive,
                ]}
              >
                Categories
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.chartContainer}>
          {/* Render donut chart with interactive features */}
          <View style={{ width: chartSize, height: chartSize }}>
            <PieChart
              donut
              data={chartData}
              radius={radius}
              innerRadius={radius * 0.6}
              innerCircleColor={BACKGROUND}
              isAnimated={network !== "devnet"}
              animationDuration={
                network === "devnet" ? 200 : CHART_CONFIG.ANIMATION_DURATION
              }
              focusOnPress
              toggleFocusOnPress
              onPress={handlePress}
              strokeWidth={0}
            />
          </View>
          {/* Display total portfolio value in center */}
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.centerCaption}>Total Balance</Text>
            <Text style={styles.centerValue}>{formatUsd(totalUsd)}</Text>
          </View>
        </View>
        {/* Render legend showing asset distribution */}
        {showLegend ? (
          <View style={styles.legend}>
            {chartData.map((entry, index) => (
              <TouchableOpacity
                key={`${entry.symbol}-${index}`}
                style={styles.legendRow}
                onPress={() => handleLegendPress(entry, index)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: entry.color },
                    focusedIndex === index && styles.focusedDot,
                  ]}
                />
                <Text style={styles.legendLabel}>{entry.symbol}</Text>
                <View style={styles.legendSpacer} />
                <Text style={styles.legendValue}>{entry.percentage}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricLabelRow}>
              <Feather
                name="bar-chart-2"
                size={12}
                color={TEXT_SECONDARY}
                style={styles.metricLabelIcon}
              />
              <Text style={styles.metricLabel}>Top 3 Share</Text>
            </View>
            <Text style={styles.metricValue}>
              {concentrationMetrics.top3Percent.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricLabelRow}>
              <Feather
                name="target"
                size={12}
                color={TEXT_SECONDARY}
                style={styles.metricLabelIcon}
              />
              <Text style={styles.metricLabel}>HHI</Text>
            </View>
            <Text style={styles.metricValue}>
              {Math.round(concentrationMetrics.hhi)}
            </Text>
            <Text style={styles.metricSubValue}>
              {concentrationMetrics.concentration}
            </Text>
          </View>
        </View>

        {selectedCategory ? (
          <View style={styles.drilldownCard}>
            <View style={styles.drilldownTitleRow}>
              <Feather
                name="activity"
                size={12}
                color={TEXT_PRIMARY}
                style={styles.metricLabelIcon}
              />
              <Text style={styles.drilldownTitle}>
                {selectedCategory} Breakdown
              </Text>
            </View>
            {selectedCategoryItems.length > 0 ? (
              selectedCategoryItems.map((item) => (
                <View key={item.symbol} style={styles.drilldownRow}>
                  <Text style={styles.drilldownSymbol}>{item.symbol}</Text>
                  <View style={styles.legendSpacer} />
                  <Text style={styles.drilldownValue}>
                    {formatUsd(item.usdValue)}
                  </Text>
                  <Text style={styles.drilldownPercent}>
                    {(item.percentage * 100).toFixed(1)}%
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.drilldownEmpty}>
                No assets in this category
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

/**
 * Stylesheet for GiftedPieChart component
 * Contains all styling for container, chart, labels, and legend
 */
const styles = StyleSheet.create({
  // Main container with dark background and rounded corners
  container: {
    backgroundColor: BACKGROUND,
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // Wrapper for chart layout
  chartWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  modeSwitchRow: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeSwitchButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeSwitchButtonActive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  modeSwitchContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeSwitchIcon: {
    marginRight: 6,
  },
  modeSwitchText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  modeSwitchTextActive: {
    color: TEXT_PRIMARY,
  },
  // Container for chart and center label
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Center label displaying total balance
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  // Caption text above the total value
  centerCaption: {
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  // Large total value text in center
  centerValue: {
    fontSize: 30,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  // Legend container below chart
  legend: {
    width: "100%",
    marginTop: 18,
    rowGap: 10,
  },
  // Individual legend row with dot, label, and percentage
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  // Small colored dot indicating asset
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  // Enlarged dot when slice is focused
  focusedDot: {
    transform: [{ scale: 1.3 }],
  },
  // Asset symbol text in legend
  legendLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  // Flexible spacer between label and percentage
  legendSpacer: {
    flex: 1,
  },
  // Percentage value text in legend
  legendValue: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  metricsRow: {
    marginTop: 14,
    width: "100%",
    flexDirection: "row",
    columnGap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricLabelIcon: {
    marginRight: 6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  metricSubValue: {
    marginTop: 2,
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  drilldownCard: {
    width: "100%",
    marginTop: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    rowGap: 8,
  },
  drilldownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  drilldownTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  drilldownRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  drilldownSymbol: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  drilldownValue: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginRight: 8,
  },
  drilldownPercent: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },
  drilldownEmpty: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  // State text for loading/error/empty states
  stateText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_PRIMARY,
    textAlign: "center",
    paddingVertical: 32,
  },
  // Additional state information text
  stateSubtext: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginTop: 6,
  },
});

export { GiftedPieChart };
