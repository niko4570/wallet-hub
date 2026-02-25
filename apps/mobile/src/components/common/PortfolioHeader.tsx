import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatPercentChange } from "../../utils";

interface PortfolioHeaderProps {
  totalValueUSD: number;
  change24hPercent: number;
}

const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  totalValueUSD,
  change24hPercent,
}) => {
  // Format total value as USD
  const formatTotalValue = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format change percentage
  const formatChangePercent = (percent: number): string => {
    return formatPercentChange(percent);
  };

  // Determine change color based on percentage
  const getChangeColor = (percent: number): string => {
    return percent >= 0 ? "#66F2C3" : "#FF8BA7";
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Total Portfolio Value</Text>
        <Text style={styles.totalValue}>{formatTotalValue(totalValueUSD)}</Text>
        <Text
          style={[
            styles.changePercent,
            { color: getChangeColor(change24hPercent) },
          ]}
        >
          {formatChangePercent(change24hPercent)} (24h)
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#050814",
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  changePercent: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PortfolioHeader;
