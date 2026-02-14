import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { formatUsd } from "../../utils/format";

interface TokenData {
  mint: string;
  symbol?: string;
  name?: string;
  balance: number;
  usdValue: number;
  decimals: number;
}

interface TokenPieProps {
  data: TokenData[];
  title?: string;
  height?: number;
  maxItems?: number;
  showPercentage?: boolean;
}

const COLORS = [
  "#9CFFDA",
  "#A855F7",
  "#6366F1",
  "#7C3AED",
  "#EC4899",
  "#F43F5E",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
];

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const createDonutSegmentPath = (
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) => {
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const startOuter = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const endOuter = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const startInner = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const endInner = polarToCartesian(centerX, centerY, innerRadius, endAngle);

  return [
    "M",
    startOuter.x,
    startOuter.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    0,
    endOuter.x,
    endOuter.y,
    "L",
    startInner.x,
    startInner.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    1,
    endInner.x,
    endInner.y,
    "Z",
  ].join(" ");
};

export const TokenPie: React.FC<TokenPieProps> = ({
  data,
  title = "Token Distribution",
  height = 250,
  maxItems = 5,
  showPercentage = true,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No token data available</Text>
        </View>
      </View>
    );
  }

  const sortedData = [...data].sort((a, b) => b.usdValue - a.usdValue);
  const topTokens = sortedData.slice(0, maxItems);
  const remainingTokens = sortedData.slice(maxItems);

  const otherTotal = remainingTokens.reduce(
    (sum, token) => sum + token.usdValue,
    0,
  );

  const pieData = topTokens.map((token, index) => ({
    label: token.symbol || token.name || token.mint.substring(0, 4),
    value: token.usdValue,
    color: COLORS[index % COLORS.length],
    token,
  }));

  if (otherTotal > 0) {
    pieData.push({
      label: "Other",
      value: otherTotal,
      color: COLORS[pieData.length % COLORS.length],
      token: { symbol: "Other", usdValue: otherTotal } as TokenData,
    });
  }

  const totalValue = pieData.reduce((sum, item) => sum + item.value, 0);
  const chartSize = Math.max(160, height - 110);
  const center = chartSize / 2;
  const outerRadius = chartSize / 2;
  const innerRadius = outerRadius * 0.6;

  const segments = useMemo(() => {
    if (!totalValue) {
      return [];
    }
    let cumulativeAngle = 0;
    return pieData.map((item) => {
      const angle = (item.value / totalValue) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;
      return {
        ...item,
        path: createDonutSegmentPath(
          center,
          center,
          outerRadius,
          innerRadius,
          startAngle,
          endAngle,
        ),
      };
    });
  }, [center, innerRadius, outerRadius, pieData, totalValue]);

  return (
    <View style={[styles.container, { height }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartContainer}>
        <Svg width={chartSize} height={chartSize}>
          {segments.map((segment, index) => (
            <Path
              key={`${segment.label}-${index}`}
              d={segment.path}
              fill={segment.color}
              stroke="#050814"
              strokeWidth={1}
            />
          ))}
        </Svg>
        <View style={styles.centerLabel}>
          <Text style={styles.centerLabelText}>Total</Text>
          <Text style={styles.centerValueText}>{formatUsd(totalValue)}</Text>
        </View>
      </View>
      <View style={styles.legend}>
        {pieData.map((item, index) => {
          const token = item.token;
          const label =
            token.symbol || token.name || token.mint.substring(0, 4);
          const percentage = totalValue
            ? ((item.value / totalValue) * 100).toFixed(1)
            : "0.0";
          return (
            <View key={`${item.label}-${index}`} style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {label}
              </Text>
              <Text style={styles.legendValue}>
                {formatUsd(item.value)}
                {showPercentage && ` (${percentage}%)`}
              </Text>
            </View>
          );
        })}
      </View>
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  centerLabel: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -30 }, { translateY: -20 }],
    alignItems: "center",
  },
  centerLabelText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
    marginBottom: 4,
  },
  centerValueText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  legend: {
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  legendValue: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
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
});
