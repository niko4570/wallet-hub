import React, { useMemo, useEffect } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Pie, PolarChart } from "victory-native";
import { buildPortfolioAllocation } from "../../utils";
import { CHART_CONFIG } from "../../config/appConfig";
import { useTheme } from "../../theme/ThemeContext";
import type { AppTheme } from "../../theme";

interface Token {
  symbol: string;
  usdValue: number;
}

interface AssetAllocationPieChartProps {
  tokens: Token[];
  loading?: boolean;
  error?: string;
}

const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((value) => value + value)
            .join("")
        : hex;
    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return color;
};

const getPalette = () => [
  "#7F56D9", // primary - vibrant purple
  "#C7B5FF", // secondary - lighter purple
  "#5B6FD6", // slate blue
  "#7C5CFF", // vivid purple
  "#4B7DBB", // dusty blue
  "#3F6B9E", // medium blue
  "#2E8BBE", // ocean blue
  "#2D6E9A", // deep blue
];
const SMALL_TOKEN_THRESHOLD = 0.05; // 5%

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
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const palette = useMemo(() => getPalette(), []);

  const { totalUsd, allocation } = useMemo(
    () =>
      buildPortfolioAllocation(
        tokens,
        CHART_CONFIG.ASSET_ALLOCATION_MIN_VALUE_USD,
      ),
    [tokens],
  );

  const { slices } = useMemo(() => {
    if (allocation.length === 0) {
      return { slices: [] as typeof allocation };
    }

    const major: typeof allocation = [];
    const minor: typeof allocation = [];

    allocation.forEach((entry) => {
      if (entry.symbol === "SOL" || entry.percentage >= SMALL_TOKEN_THRESHOLD) {
        major.push(entry);
      } else {
        minor.push(entry);
      }
    });

    const othersUsd = minor.reduce((sum, entry) => sum + entry.usdValue, 0);
    if (othersUsd > 0) {
      major.push({
        symbol: "Others",
        usdValue: othersUsd,
        percentage: othersUsd / totalUsd,
      });
    }

    const maxSlices = Math.max(1, CHART_CONFIG.ASSET_ALLOCATION_MAX_SLICES);
    if (major.length <= maxSlices) {
      return {
        slices: major,
      };
    }

    const sorted = [...major].sort((a, b) => b.usdValue - a.usdValue);
    const top = sorted.slice(0, maxSlices - 1);
    const remainder = sorted.slice(maxSlices - 1);

    const remainderUsd = remainder.reduce(
      (sum, entry) => sum + entry.usdValue,
      0,
    );
    if (remainderUsd > 0) {
      top.push({
        symbol: "Others",
        usdValue: remainderUsd,
        percentage: remainderUsd / totalUsd,
      });
    }

    return {
      slices: top,
    };
  }, [allocation, totalUsd]);

  const transition = useSharedValue(0);
  useEffect(() => {
    transition.value = 0;
    transition.value = withTiming(1, { duration: 520 });
  }, [slices.length, totalUsd, transition]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: transition.value,
    transform: [{ scale: 0.96 + 0.04 * transition.value }],
  }));

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Asset Allocation</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading asset allocation...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Asset Allocation</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error loading asset allocation</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </View>
    );
  }

  if (slices.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Asset Allocation</Text>
        <Text style={styles.emptyText}>No assets to display</Text>
      </View>
    );
  }

  // Prepare data for VictoryPie
  const chartData = slices.map((slice, index) => ({
    x: slice.symbol,
    y: slice.usdValue,
    symbol: slice.symbol,
    usdValue: slice.usdValue,
    percentage: Math.round(slice.percentage * 100),
    color:
      slice.symbol === "Others"
        ? withAlpha(theme.colors.onSurface as string, 0.25)
        : palette[index % palette.length],
  }));

  // Get screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;

  // Responsive padding
  const padding = isDesktop ? 32 : isTablet ? 28 : 24;

  // Responsive chart dimensions
  const chartWidth = screenWidth - padding * 2;
  const chartHeight = Math.min(
    isDesktop ? 350 : isTablet ? 320 : 300,
    screenWidth * 0.7,
  );
  const innerRadius = Math.min(
    isDesktop ? 100 : isTablet ? 90 : 85,
    screenWidth * 0.2,
  );
  const outerRadius = Math.min(
    isDesktop ? 130 : isTablet ? 120 : 110,
    screenWidth * 0.3,
  );

  // Responsive font sizes
  const labelFontSize = Math.min(
    isDesktop ? 15 : isTablet ? 14 : 13,
    screenWidth * 0.035,
  );
  const legendFontSize = Math.min(
    isDesktop ? 14 : isTablet ? 13 : 12,
    screenWidth * 0.03,
  );
  const centerValueFontSize = Math.min(
    isDesktop ? 32 : isTablet ? 30 : 28,
    screenWidth * 0.08,
  );
  const titleFontSize = Math.min(
    isDesktop ? 14 : isTablet ? 13 : 12,
    screenWidth * 0.03,
  );

  const totalChartValue = chartData.reduce(
    (sum, entry) => sum + entry.usdValue,
    0,
  );

  let labelStartAngle = 0;
  const labelData = chartData
    .map((entry, index) => {
      const sweepAngle =
        totalChartValue === 0 ? 0 : (entry.usdValue / totalChartValue) * 360;
      const midAngle = labelStartAngle + sweepAngle / 2;
      labelStartAngle += sweepAngle;

      if (entry.percentage <= 5) {
        return null;
      }

      const radius = (innerRadius + outerRadius) / 2;
      const radians = (midAngle * Math.PI) / 180;
      const x = chartWidth / 2 + radius * Math.cos(-radians);
      const y = chartHeight / 2 + radius * Math.sin(radians);
      const width = labelFontSize * 2.2;
      const height = labelFontSize * 1.2;

      return {
        key: `${entry.symbol}-${index}`,
        text: `${entry.percentage}%`,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <LinearGradient
      colors={[
        withAlpha(theme.colors.background as string, 0.92),
        withAlpha(theme.colors.surface as string, 0.88),
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { padding }]}
    >
      <LinearGradient
        colors={[
          withAlpha(theme.colors.onSurface as string, 0.08),
          "rgba(255, 255, 255, 0.01)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.glassOverlay,
          { borderRadius: isDesktop ? 32 : isTablet ? 28 : 26 },
        ]}
        pointerEvents="none"
      />
      <Text style={[styles.title, { fontSize: titleFontSize }]}>
        Asset Allocation
      </Text>
      <Animated.View style={[styles.chartWrapper, animatedStyle]}>
        <View style={styles.chartContainer}>
          <View
            style={[
              styles.chartCanvas,
              { width: chartWidth, height: chartHeight },
            ]}
          >
            <PolarChart
              data={chartData}
              labelKey="symbol"
              valueKey="usdValue"
              colorKey="color"
              containerStyle={{ width: chartWidth, height: chartHeight }}
            >
              <Pie.Chart innerRadius={innerRadius} size={outerRadius * 2}>
                {() => (
                  <Pie.Slice
                    stroke={{ width: isDesktop ? 3 : isTablet ? 2.5 : 2 }}
                  />
                )}
              </Pie.Chart>
            </PolarChart>
            <View
              pointerEvents="none"
              style={[
                styles.labelLayer,
                { width: chartWidth, height: chartHeight },
              ]}
            >
              {labelData.map((label) => (
                <View
                  key={label.key}
                  style={{
                    position: "absolute",
                    left: label.x,
                    top: label.y,
                    width: label.width,
                    height: label.height,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={[
                      styles.sliceLabel,
                      {
                        fontSize: labelFontSize,
                        color: withAlpha(
                          theme.colors.onSurface as string,
                          0.85,
                        ),
                      },
                    ]}
                  >
                    {label.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.centerLabel}>
            <Text
              style={[
                styles.centerCaption,
                { fontSize: isDesktop ? 13 : isTablet ? 12 : 11 },
              ]}
            >
              Total
            </Text>
            <Text
              style={[styles.centerValue, { fontSize: centerValueFontSize }]}
            >
              {formatUsd(totalUsd)}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.legend,
            { marginTop: isDesktop ? 20 : isTablet ? 16 : 12 },
          ]}
        >
          {chartData.map((entry) => (
            <View key={entry.symbol} style={styles.legendRow}>
              <View
                style={[
                  styles.legendSwatch,
                  {
                    backgroundColor: entry.color,
                    width: isDesktop ? 12 : isTablet ? 11 : 10,
                    height: isDesktop ? 12 : isTablet ? 11 : 10,
                    marginRight: isDesktop ? 10 : isTablet ? 9 : 8,
                  },
                ]}
              />
              <Text style={[styles.legendSymbol, { fontSize: legendFontSize }]}>
                {entry.symbol}
              </Text>
              <View style={styles.legendSpacer} />
              <Text
                style={[styles.legendPercent, { fontSize: legendFontSize }]}
              >
                {entry.percentage}%
              </Text>
              <Text style={[styles.legendValue, { fontSize: legendFontSize }]}>
                {formatUsd(entry.usdValue)}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: withAlpha(theme.colors.surface as string, 0.86),
      borderRadius: 26,
      padding: 24,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primary as string, 0.18),
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 7,
    },
    title: {
      fontSize: 12,
      fontWeight: "700",
      color: withAlpha(theme.colors.onSurface as string, 0.75),
      marginBottom: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    chartWrapper: {
      alignItems: "center",
      justifyContent: "center",
    },
    chartContainer: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      position: "relative",
    },
    chartCanvas: {
      alignItems: "center",
      justifyContent: "center",
    },
    centerLabel: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
    },
    legend: {
      width: "100%",
      marginTop: 12,
      rowGap: 8,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 3,
      marginRight: 8,
    },
    legendSymbol: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.onSurface as string,
    },
    legendSpacer: {
      flex: 1,
    },
    legendPercent: {
      fontSize: 12,
      color: withAlpha(theme.colors.onSurface as string, 0.7),
      marginRight: 10,
    },
    legendValue: {
      fontSize: 12,
      fontWeight: "600",
      color: withAlpha(theme.colors.onSurface as string, 0.9),
    },
    labelLayer: {
      position: "absolute",
      top: 0,
      left: 0,
    },
    sliceLabel: {
      fontWeight: "600",
      textAlign: "center",
    },
    centerCaption: {
      fontSize: 11,
      color: withAlpha(theme.colors.onSurface as string, 0.6),
      letterSpacing: 0.4,
      marginBottom: 2,
      fontWeight: "500",
    },
    centerValue: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.onSurface as string,
      letterSpacing: 0.2,
    },
    emptyText: {
      fontSize: 14,
      color: withAlpha(theme.colors.onSurface as string, 0.6),
      textAlign: "center",
      paddingVertical: 40,
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      fontSize: 14,
      color: withAlpha(theme.colors.onSurface as string, 0.6),
      textAlign: "center",
    },
    errorContainer: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.error as string,
      textAlign: "center",
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 12,
      color: withAlpha(theme.colors.onSurface as string, 0.6),
      textAlign: "center",
      maxWidth: "80%",
    },
    tooltip: {
      position: "absolute",
      backgroundColor: withAlpha(theme.colors.surface as string, 0.95),
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primary as string, 0.2),
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
      minWidth: 100,
      alignItems: "center",
      zIndex: 100,
    },
    tooltipSymbol: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.onSurface as string,
      marginBottom: 4,
    },
    tooltipValue: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.primary as string,
      marginBottom: 2,
    },
    tooltipPercentage: {
      fontSize: 12,
      color: withAlpha(theme.colors.onSurface as string, 0.7),
    },
    glassOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
    },
  });

export { AssetAllocationPieChart };
