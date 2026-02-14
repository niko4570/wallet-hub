import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";

interface BalanceData {
  timestamp: number;
  usd: number;
  sol: number;
}

interface BalanceChartProps {
  data: BalanceData[];
  title?: string;
  height?: number;
  showSolLine?: boolean;
}

const { width: screenWidth } = Dimensions.get("window");
const CHART_WIDTH = screenWidth - 48;

interface Point {
  x: number;
  y: number;
}

const buildPath = (points: Point[]): string => {
  if (!points.length) {
    return "";
  }
  return points
    .map((point, index) => {
      const prefix = index === 0 ? "M" : "L";
      return `${prefix}${point.x},${point.y}`;
    })
    .join(" ");
};

const buildAreaPath = (points: Point[], chartHeight: number): string => {
  if (points.length < 2) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];

  return `${buildPath(points)} L${last.x},${chartHeight} L${first.x},${chartHeight} Z`;
};

export const BalanceChart: React.FC<BalanceChartProps> = ({
  data,
  title = "Balance History",
  height = 200,
  showSolLine = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No balance history data</Text>
        </View>
      </View>
    );
  }

  const chartHeight = Math.max(140, height - 60);

  const {
    usdPoints,
    solPoints,
    usdPath,
    usdAreaPath,
    solPath,
  } = useMemo(() => {
    const timestamps = data.map((item) => item.timestamp);
    const usdValues = data.map((item) => item.usd);
    const solValues = showSolLine ? data.map((item) => item.sol) : [];

    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    const allYValues = [...usdValues, ...solValues];
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);

    const safeMaxX = maxX === minX ? maxX + 1 : maxX;
    const safeMaxY = maxY === minY ? maxY + 1 : maxY;

    const scaleX = (value: number) =>
      ((value - minX) / (safeMaxX - minX)) * CHART_WIDTH;
    const scaleY = (value: number) =>
      chartHeight - ((value - minY) / (safeMaxY - minY)) * chartHeight;

    const usdPts = data.map((item) => ({
      x: scaleX(item.timestamp),
      y: scaleY(item.usd),
    }));

    const solPts = showSolLine
      ? data.map((item) => ({
          x: scaleX(item.timestamp),
          y: scaleY(item.sol),
        }))
      : [];

    return {
      usdPoints: usdPts,
      solPoints: solPts,
      usdPath: buildPath(usdPts),
      usdAreaPath: buildAreaPath(usdPts, chartHeight),
      solPath: buildPath(solPts),
    };
  }, [data, chartHeight, showSolLine]);

  return (
    <View style={[styles.container, { height }]}>
      <Text style={styles.title}>{title}</Text>
      <View
        style={[
          styles.chartContainer,
          { height: chartHeight + 20, width: CHART_WIDTH },
        ]}
      >
        <Svg width={CHART_WIDTH} height={chartHeight}>
          <Defs>
            <LinearGradient id="balanceArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="rgba(156, 255, 218, 0.35)" />
              <Stop offset="100%" stopColor="rgba(156, 255, 218, 0.05)" />
            </LinearGradient>
          </Defs>
          {usdAreaPath ? (
            <Path d={usdAreaPath} fill="url(#balanceArea)" stroke="none" />
          ) : null}
          {usdPath ? (
            <Path
              d={usdPath}
              stroke="#9CFFDA"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          {showSolLine && solPath ? (
            <Path
              d={solPath}
              stroke="#A855F7"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
      {showSolLine && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#9CFFDA" }]} />
            <Text style={styles.legendText}>USD Value</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#A855F7" }]} />
            <Text style={styles.legendText}>SOL Balance</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 12,
  },
  chartContainer: {
    position: "relative",
  },
  tooltip: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#1F2937",
    borderColor: "#4B5563",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    zIndex: 10,
  },
  tooltipText: {
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: "600",
  },
  tooltipSubtext: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
  },
});
