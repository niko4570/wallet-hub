import React, { useRef, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { CartesianChart, Line, Scatter } from "victory-native";
import { formatPercentChange } from "../../utils";
import { CHART_CONFIG, COLORS } from "../../config/appConfig";

interface PortfolioHistoryItem {
  timestamp: number;
  totalValueUSD: number;
}

interface ModernPortfolioLineChartProps {
  history: PortfolioHistoryItem[];
}

const ModernPortfolioLineChart: React.FC<ModernPortfolioLineChartProps> = ({
  history,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const hasData = history.length >= 1;

  // Get screen dimensions for responsive design
  const { width: screenWidth } = Dimensions.get("window");
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;

  // Responsive chart height
  const chartHeight = isDesktop
    ? 300
    : isTablet
      ? 270
      : CHART_CONFIG.CHART_HEIGHT;

  // Responsive font sizes
  const lastValueFontSize = isDesktop ? 36 : isTablet ? 32 : 30;
  const headerLabelFontSize = isDesktop ? 14 : isTablet ? 13 : 12;
  const changeTextFontSize = isDesktop ? 14 : isTablet ? 13 : 12;
  const emptyStateFontSize = isDesktop ? 15 : isTablet ? 14 : 13;

  // Responsive padding and spacing
  const containerPadding = isDesktop ? 32 : isTablet ? 28 : 24;
  const headerMarginBottom = isDesktop ? 32 : isTablet ? 28 : 24;
  const chartFramePadding = isDesktop ? 12 : isTablet ? 10 : 8;
  const borderRadius = isDesktop ? 32 : isTablet ? 28 : 24;

  // Extract data for chart
  const lastValue = useMemo(
    () => (history.length > 0 ? history[history.length - 1].totalValueUSD : 0),
    [history],
  );

  const firstValue = useMemo(
    () => (history.length > 0 ? history[0].totalValueUSD : 0),
    [history],
  );

  const percentageChange = useMemo(
    () => (firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0),
    [firstValue, lastValue],
  );

  const isPositiveChange = percentageChange >= 0;
  const lineColor = COLORS.GREEN;

  // Format USD value
  const formatUSD = useMemo(() => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (value: number): string => formatter.format(value);
  }, []);

  // Remove outliers using IQR method
  const removeOutliers = (
    data: Array<{ x: number; y: number }>,
  ): Array<{ x: number; y: number }> => {
    if (data.length <= 4) return data;

    const values = data.map((item) => item.y).sort((a, b) => a - b);
    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.filter((item) => item.y >= lowerBound && item.y <= upperBound);
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    // Sort data by timestamp ascending
    const sortedHistory = [...history].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    // Convert to format with timestamp as x (rounded to minutes), filter out invalid data
    let processedData = sortedHistory
      .map((item) => ({
        // Round timestamp to nearest minute
        x: Math.round(item.timestamp / 60000) * 60000,
        y: item.totalValueUSD,
      }))
      // Filter out invalid values
      .filter(
        (item) =>
          item.y !== null &&
          item.y !== undefined &&
          !isNaN(item.y) &&
          item.y > 0,
      );

    // Remove outliers
    processedData = removeOutliers(processedData);

    // Remove duplicate x values (keep the latest occurrence)
    const uniqueDataMap = new Map<number, (typeof processedData)[0]>();
    for (const item of processedData) {
      uniqueDataMap.set(item.x, item);
    }

    // Convert back to array and sort by x ascending
    return Array.from(uniqueDataMap.values()).sort((a, b) => a.x - b.x);
  }, [history]);

  // Calculate Y domain with exact min/max * 0.99/1.01
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100] as [number, number];

    const values = chartData.map((item) => item.y);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);

    return [minY * 0.99, maxY * 1.01] as [number, number];
  }, [chartData]);

  // Calculate X domain
  const xDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1] as [number, number];

    const timestamps = chartData.map((item) => item.x);
    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);

    return [minX, maxX] as [number, number];
  }, [chartData]);

  // Animate on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          padding: containerPadding,
          borderRadius,
        },
      ]}
    >
      {/* Portfolio value header */}
      <View style={[styles.header, { marginBottom: headerMarginBottom }]}>
        <View>
          <Text style={[styles.headerLabel, { fontSize: headerLabelFontSize }]}>
            Portfolio Value
          </Text>
          <Text style={[styles.lastValue, { fontSize: lastValueFontSize }]}>
            {formatUSD(lastValue)}
          </Text>
        </View>
        <View
          style={[
            styles.changeContainer,
            isPositiveChange ? styles.positiveChange : styles.negativeChange,
            {
              paddingHorizontal: isDesktop ? 16 : isTablet ? 14 : 12,
              paddingVertical: isDesktop ? 8 : isTablet ? 7 : 6,
            },
          ]}
        >
          <Text style={[styles.changeText, { fontSize: changeTextFontSize }]}>
            {formatPercentChange(percentageChange)}
          </Text>
        </View>
      </View>

      {/* Chart frame */}
      <View style={[styles.chartFrame, { paddingVertical: chartFramePadding }]}>
        {hasData ? (
          <View style={styles.glowWrapper}>
            <View style={[styles.chartCanvas, { height: chartHeight }]}>
              <CartesianChart
                data={chartData}
                xKey="x"
                yKeys={["y"]}
                padding={{ left: 0, right: 0, top: 10, bottom: 10 }}
                domain={{ x: xDomain, y: yDomain }}
                domainPadding={{ left: 0, right: 0, top: 0, bottom: 0 }}
                frame={{ lineWidth: 0, lineColor: "transparent" }}
                xAxis={{
                  lineWidth: 0,
                  labelColor: "transparent",
                  tickCount: 0,
                }}
                yAxis={[
                  {
                    lineWidth: 0,
                    labelColor: "transparent",
                    tickCount: 0,
                  },
                ]}
              >
                {({ points }) => {
                  const linePoints = points.y;
                  const lastPoint = linePoints[linePoints.length - 1];
                  const markerPoints =
                    lastPoint && typeof lastPoint.y === "number"
                      ? [lastPoint]
                      : [];

                  return (
                    <>
                      {linePoints.length >= 2 && (
                        <>
                          {/* Glow effect layer */}
                          <Line
                            points={linePoints}
                            curveType="monotoneX"
                            color={lineColor}
                            strokeWidth={6}
                            strokeCap="round"
                            strokeJoin="round"
                            opacity={0.2}
                          />
                          {/* Main line layer */}
                          <Line
                            points={linePoints}
                            curveType="monotoneX"
                            color={lineColor}
                            strokeWidth={3}
                            strokeCap="round"
                            strokeJoin="round"
                            opacity={1}
                          />
                        </>
                      )}
                      {markerPoints.length > 0 && (
                        <Scatter
                          points={markerPoints}
                          radius={8}
                          color={lineColor}
                          style="fill"
                        />
                      )}
                    </>
                  );
                }}
              </CartesianChart>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyState, { height: chartHeight }]}>
            <Text
              style={[styles.emptyStateText, { fontSize: emptyStateFontSize }]}
            >
              Not enough data yet
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 24,
    padding: 24,
    marginVertical: 8,
    shadowColor: COLORS.SHADOW,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "600",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  lastValue: {
    fontSize: 30,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  changeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  positiveChange: {
    backgroundColor: COLORS.GREEN_LIGHT,
  },
  negativeChange: {
    backgroundColor: COLORS.RED_LIGHT,
  },
  changeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  chartFrame: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 16,
  },
  chartCanvas: {
    width: "100%",
    height: CHART_CONFIG.CHART_HEIGHT,
  },
  glowWrapper: {
    shadowColor: COLORS.GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  emptyState: {
    height: CHART_CONFIG.CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 0.3,
  },
});

export default ModernPortfolioLineChart;
