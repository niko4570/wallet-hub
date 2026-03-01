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
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import { buildPortfolioAllocation } from "../../utils";
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
}

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
  }, [allocation]);

  // Transform allocation data into chart-ready format with colors and percentages
  const chartData: ChartDataPoint[] = useMemo(() => {
    const isDevnet = network === "devnet";
    const palette = isDevnet ? COLORS_DEV : COLORS;

    return slices.map((slice, index) => {
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
      };
    });
  }, [slices]);

  // Handle slice press event to update focus state
  const handlePress = useCallback((item: any, index: number) => {
    setFocusedIndex(index);
  }, []);

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
  if (slices.length === 0) {
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
              <View key={entry.symbol} style={styles.legendRow}>
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
              </View>
            ))}
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
    alignItems: "center",
    justifyContent: "center",
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
