import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";

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
  loading?: boolean;
  error?: string | null;
}

const { width: screenWidth } = Dimensions.get("window");
const CHART_WIDTH = screenWidth - 48;
const OPTIMAL_DATA_POINTS = 24; // Target 24 data points for 24h chart

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

// Linear interpolation between two points
const interpolate = (
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  if (x1 === x2) return y1;
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
};

// Interpolate data to get even distribution
const interpolateData = (data: BalanceData[]): BalanceData[] => {
  if (data.length <= 1) return data;

  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const minX = sortedData[0].timestamp;
  const maxX = sortedData[sortedData.length - 1].timestamp;

  // Create evenly spaced time points
  const interpolated: BalanceData[] = [];
  const step = (maxX - minX) / (OPTIMAL_DATA_POINTS - 1);

  for (let i = 0; i < OPTIMAL_DATA_POINTS; i++) {
    const timestamp = minX + step * i;

    // Find the two closest data points
    let left = 0;
    let right = sortedData.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedData[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Interpolate between the two closest points
    if (left === 0) {
      // Use the first point
      interpolated.push(sortedData[0]);
    } else if (left >= sortedData.length) {
      // Use the last point
      interpolated.push(sortedData[sortedData.length - 1]);
    } else {
      const prev = sortedData[left - 1];
      const curr = sortedData[left];

      const usd = interpolate(
        timestamp,
        prev.timestamp,
        prev.usd,
        curr.timestamp,
        curr.usd,
      );
      const sol = interpolate(
        timestamp,
        prev.timestamp,
        prev.sol,
        curr.timestamp,
        curr.sol,
      );

      interpolated.push({ timestamp, usd, sol });
    }
  }

  return interpolated;
};

// Aggregate data if there are too many points
const aggregateData = (data: BalanceData[]): BalanceData[] => {
  if (data.length <= OPTIMAL_DATA_POINTS) return data;

  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const bucketSize = Math.ceil(data.length / OPTIMAL_DATA_POINTS);
  const aggregated: BalanceData[] = [];

  for (let i = 0; i < data.length; i += bucketSize) {
    const bucket = sortedData.slice(i, i + bucketSize);
    const timestamp = bucket[Math.floor(bucket.length / 2)].timestamp;
    const usd = bucket.reduce((sum, item) => sum + item.usd, 0) / bucket.length;
    const sol = bucket.reduce((sum, item) => sum + item.sol, 0) / bucket.length;

    aggregated.push({ timestamp, usd, sol });
  }

  return aggregated;
};

// Process data to ensure even distribution
const processData = (data: BalanceData[]): BalanceData[] => {
  if (data.length <= 1) return data;

  let processedData = data;

  // First aggregate if there are too many points
  if (processedData.length > OPTIMAL_DATA_POINTS) {
    processedData = aggregateData(processedData);
  }

  // Then interpolate if there are too few points
  if (processedData.length < OPTIMAL_DATA_POINTS) {
    processedData = interpolateData(processedData);
  }

  return processedData;
};

export const BalanceChart: React.FC<BalanceChartProps> = ({
  data,
  title = "Balance History",
  height = 200,
  showSolLine = false,
  loading = false,
  error = null,
}) => {
  const [selectedPoint, setSelectedPoint] = useState<{
    data: BalanceData;
    x: number;
    y: number;
  } | null>(null);

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <ActivityIndicator color="#9CFFDA" size="small" />
          <Text style={styles.emptyText}>Loading balance history...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

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
    processedData,
    scaleX,
    scaleY,
    minX,
    maxX,
    minY,
    maxY,
  } = useMemo(() => {
    // Validate and clean data
    const validData = data.filter((item) => {
      return (
        typeof item.timestamp === "number" &&
        !isNaN(item.timestamp) &&
        typeof item.usd === "number" &&
        !isNaN(item.usd) &&
        typeof item.sol === "number" &&
        !isNaN(item.sol)
      );
    });

    if (validData.length === 0) {
      return {
        usdPoints: [],
        solPoints: [],
        usdPath: "",
        usdAreaPath: "",
        solPath: "",
        processedData: [],
        scaleX: (value: number) => 0,
        scaleY: (value: number) => 0,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    // Process data to ensure even distribution
    const processed = processData(validData);

    const timestamps = processed.map((item) => item.timestamp);
    const usdValues = processed.map((item) => item.usd);
    const solValues = showSolLine ? processed.map((item) => item.sol) : [];

    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    const allYValues = [...usdValues, ...solValues];
    const minY = Math.min(...allYValues);
    const maxY = Math.max(...allYValues);

    const safeMaxX = maxX === minX ? maxX + 1 : maxX;
    const safeMaxY = maxY === minY ? maxY + 1 : maxY;

    const scaleXFunc = (value: number) =>
      ((value - minX) / (safeMaxX - minX)) * CHART_WIDTH;
    const scaleYFunc = (value: number) =>
      chartHeight - ((value - minY) / (safeMaxY - minY)) * chartHeight;

    const usdPts = processed.map((item) => ({
      x: scaleXFunc(item.timestamp),
      y: scaleYFunc(item.usd),
    }));

    const solPts = showSolLine
      ? processed.map((item) => ({
          x: scaleXFunc(item.timestamp),
          y: scaleYFunc(item.sol),
        }))
      : [];

    return {
      usdPoints: usdPts,
      solPoints: solPts,
      usdPath: buildPath(usdPts),
      usdAreaPath: buildAreaPath(usdPts, chartHeight),
      solPath: buildPath(solPts),
      processedData: processed,
      scaleX: scaleXFunc,
      scaleY: scaleYFunc,
      minX,
      maxX,
      minY,
      maxY,
    };
  }, [data, chartHeight, showSolLine]);

  // Handle chart tap to select data point
  const handleChartTap = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;

    // Find the closest data point
    let closestPoint = null;
    let closestDistance = Infinity;

    processedData.forEach((dataPoint, index) => {
      const x = scaleX(dataPoint.timestamp);
      const y = scaleY(dataPoint.usd);
      const distance = Math.sqrt(
        Math.pow(x - locationX, 2) + Math.pow(y - locationY, 2),
      );

      if (distance < closestDistance && distance < 30) {
        // 30px threshold
        closestDistance = distance;
        closestPoint = {
          data: dataPoint,
          x,
          y,
        };
      }
    });

    setSelectedPoint(closestPoint);
  };

  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date for older data points
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      return formatTime(timestamp);
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <Text style={styles.title}>{title}</Text>
      <View
        style={[
          styles.chartContainer,
          { height: chartHeight + 20, width: CHART_WIDTH },
        ]}
      >
        <TouchableWithoutFeedback onPress={handleChartTap}>
          <View style={{ width: CHART_WIDTH, height: chartHeight }}>
            <Svg width={CHART_WIDTH} height={chartHeight}>
              <Defs>
                <LinearGradient
                  id="balanceArea"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
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
              {/* Render data points as interactive circles */}
              {processedData.map((dataPoint, index) => {
                const x = scaleX(dataPoint.timestamp);
                const y = scaleY(dataPoint.usd);
                return (
                  <Circle
                    key={index}
                    cx={x}
                    cy={y}
                    r={4}
                    fill="#9CFFDA"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    opacity={0.7}
                  />
                );
              })}
              {/* Render selected point highlight */}
              {selectedPoint && (
                <>
                  <Circle
                    cx={selectedPoint.x}
                    cy={selectedPoint.y}
                    r={8}
                    fill="#FFFFFF"
                    stroke="#9CFFDA"
                    strokeWidth={2}
                  />
                  <Circle
                    cx={selectedPoint.x}
                    cy={selectedPoint.y}
                    r={4}
                    fill="#9CFFDA"
                  />
                </>
              )}
            </Svg>
          </View>
        </TouchableWithoutFeedback>
        {/* Tooltip for selected data point */}
        {selectedPoint && (
          <View
            style={[
              styles.tooltip,
              {
                left: selectedPoint.x - 60,
                top: selectedPoint.y - 80,
              },
            ]}
          >
            <Text style={styles.tooltipText}>
              {formatDate(selectedPoint.data.timestamp)}
            </Text>
            <Text style={styles.tooltipSubtext}>
              ${selectedPoint.data.usd.toFixed(2)}
            </Text>
            <Text style={styles.tooltipSubtext}>
              {selectedPoint.data.sol.toFixed(4)} SOL
            </Text>
          </View>
        )}
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
  errorText: {
    color: "#FF8BA7",
    fontSize: 12,
    textAlign: "center",
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
