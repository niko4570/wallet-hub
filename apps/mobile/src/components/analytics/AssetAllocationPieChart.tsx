import React, { useMemo, useEffect } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import {
  LinearGradient as SkiaLinearGradient,
  vec,
} from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Pie, PolarChart } from "victory-native";
import { buildPortfolioAllocation } from "../../utils";
import { CHART_CONFIG } from "../../config/appConfig";

interface Token {
  symbol: string;
  usdValue: number;
}

interface ChartDataPoint {
  [key: string]: unknown;
  symbol: string;
  usdValue: number;
  percentage: number;
  index: number;
  color: string;
}

interface AssetAllocationPieChartProps {
  tokens: Token[];
  loading?: boolean;
  error?: string;
  showLegend?: boolean;
}

const BACKGROUND = "#0B0B0F";
const TEXT_PRIMARY = "#F5F5F7";
const TEXT_SECONDARY = "rgba(245, 245, 247, 0.6)";
const COLORS = {
  primaryGradient: ["#7C3AED", "#A78BFA"],
  secondary: "#2563EB",
  accent: "#0EA5E9",
  muted: "#1F1F26",
};
const PAD_ANGLE = 1.2;
const INNER_RADIUS = "80%";

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

const AssetAllocationPieChart: React.FC<AssetAllocationPieChartProps> = ({
  tokens,
  loading = false,
  error,
  showLegend = true,
}) => {
  const { totalUsd, allocation } = useMemo(
    () =>
      buildPortfolioAllocation(
        tokens,
        CHART_CONFIG.ASSET_ALLOCATION_MIN_VALUE_USD,
      ),
    [tokens],
  );

  const slices = useMemo(() => {
    if (allocation.length === 0) {
      return [] as typeof allocation;
    }

    const maxSlices = Math.max(1, CHART_CONFIG.ASSET_ALLOCATION_MAX_SLICES);
    const sorted = [...allocation].sort((a, b) => b.usdValue - a.usdValue);
    return sorted.slice(0, maxSlices);
  }, [allocation]);

  const transition = useSharedValue(0);
  useEffect(() => {
    transition.value = 0;
    transition.value = withTiming(1, { duration: 520 });
  }, [slices.length, totalUsd, transition]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: transition.value,
    transform: [{ scale: 0.96 + 0.04 * transition.value }],
  }));

  const baseData: ChartDataPoint[] = slices.map((slice, index) => {
    let color = COLORS.muted;
    if (index === 0) {
      color = COLORS.primaryGradient[0];
    } else if (index === 1) {
      color = COLORS.secondary;
    } else if (index === 2) {
      color = COLORS.accent;
    }

    return {
      symbol: slice.symbol,
      usdValue: slice.usdValue,
      percentage: Math.round(slice.percentage * 100),
      index,
      color,
    };
  });

  const primarySymbol = baseData[0]?.symbol;

  const chartData = useMemo(() => {
    return baseData;
  }, [baseData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>Loading asset allocation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>Error loading asset allocation</Text>
        <Text style={styles.stateSubtext}>{error}</Text>
      </View>
    );
  }

  if (slices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.stateText}>No assets to display</Text>
      </View>
    );
  }

  const { width: screenWidth } = Dimensions.get("window");
  const chartSize = Math.min(screenWidth * 0.64, 260);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.chartWrapper, animatedStyle]}>
        <View style={styles.chartContainer}>
          <View
            style={[
              styles.glow,
              {
                width: chartSize * 1.12,
                height: chartSize * 1.12,
                borderRadius: chartSize,
              },
            ]}
            pointerEvents="none"
          />
          <View style={{ width: chartSize, height: chartSize }}>
            <PolarChart
              data={chartData}
              labelKey={"symbol"}
              valueKey={"usdValue"}
              colorKey={"color"}
              containerStyle={{ width: chartSize, height: chartSize }}
            >
              <Pie.Chart
                innerRadius={INNER_RADIUS}
                startAngle={-90}
                circleSweepDegrees={360}
                size={chartSize}
              >
                {({ slice }) => {
                  const label = String(slice.label);
                  const isPrimary = label === primarySymbol;
                  return (
                    <Pie.Slice strokeWidth={0}>
                      {isPrimary ? (
                        <SkiaLinearGradient
                          start={vec(0, 0)}
                          end={vec(chartSize, chartSize)}
                          colors={COLORS.primaryGradient}
                        />
                      ) : null}
                    </Pie.Slice>
                  );
                }}
              </Pie.Chart>
            </PolarChart>
          </View>
          <View style={styles.centerLabel} pointerEvents="none">
            <Text style={styles.centerCaption}>Total Balance</Text>
            <Text style={styles.centerValue}>{formatUsd(totalUsd)}</Text>
          </View>
        </View>
        {showLegend ? (
          <View style={styles.legend}>
            {baseData.map((entry) => (
              <View key={entry.symbol} style={styles.legendRow}>
                <View
                  style={[styles.legendDot, { backgroundColor: entry.color }]}
                />
                <Text style={styles.legendLabel}>{entry.symbol}</Text>
                <View style={styles.legendSpacer} />
                <Text style={styles.legendValue}>{entry.percentage}%</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: BACKGROUND,
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    backgroundColor: "rgba(124, 58, 237, 0.18)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  centerCaption: {
    fontSize: 12,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  centerValue: {
    fontSize: 30,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  legend: {
    width: "100%",
    marginTop: 18,
    rowGap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  legendSpacer: {
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  stateText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_PRIMARY,
    textAlign: "center",
    paddingVertical: 32,
  },
  stateSubtext: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    textAlign: "center",
    marginTop: 6,
  },
});

export { AssetAllocationPieChart };
