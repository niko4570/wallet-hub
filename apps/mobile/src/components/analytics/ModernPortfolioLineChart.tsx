import React, { useRef, useEffect } from "react";
import { View, Text, Dimensions, StyleSheet, Animated } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";

interface ModernPortfolioLineChartProps {
  history: { timestamp: number; totalValueUSD: number }[];
}

const ModernPortfolioLineChart: React.FC<ModernPortfolioLineChartProps> = ({
  history,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Determine chart color based on percentage change
  const getChartColor = (percent: number): string => {
    return percent >= 0 ? "#66F2C3" : "#FF8BA7";
  };

  // Extract data for chart
  const chartData = {
    labels: history.map(() => ""), // Empty labels for cleaner look
    datasets: [
      {
        data: history.map((item) => item.totalValueUSD),
        color: (opacity = 1) => {
          const baseColor = percentageChange >= 0 ? "#66F2C3" : "#FF8BA7";
          // Convert hex to rgba with higher opacity
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity * 0.9})`; // Increase opacity
        },
        strokeWidth: 3, // Increase stroke width for better visibility
      },
    ],
  };

  // Get last value
  const lastValue =
    history.length > 0 ? history[history.length - 1].totalValueUSD : 0;

  // Get first value for percentage change calculation
  const firstValue = history.length > 0 ? history[0].totalValueUSD : 0;
  const percentageChange =
    firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const isPositiveChange = percentageChange >= 0;

  // Format USD value
  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percentage change
  const formatPercentage = (value: number): string => {
    return `${isPositiveChange ? "+" : ""}${value.toFixed(2)}%`;
  };

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
        },
      ]}
    >
      {/* Portfolio value header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Portfolio Value</Text>
          <Text style={styles.lastValue}>{formatUSD(lastValue)}</Text>
        </View>
        <View
          style={[
            styles.changeContainer,
            isPositiveChange ? styles.positiveChange : styles.negativeChange,
          ]}
        >
          <Text style={styles.changeText}>
            {formatPercentage(percentageChange)}
          </Text>
        </View>
      </View>

      {/* Gradient background for chart */}
      <LinearGradient
        colors={[
          `${percentageChange >= 0 ? "#66F2C340" : "#FF8BA740"}`, // 25% opacity
          `${percentageChange >= 0 ? "#66F2C31A" : "#FF8BA71A"}`, // 10% opacity
          "transparent",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientBackground}
      >
        {/* Line chart */}
        <LineChart
          data={chartData}
          width={screenWidth - 32} // Account for padding
          height={200}
          chartConfig={{
            backgroundColor: "transparent",
            backgroundGradientFrom: "transparent",
            backgroundGradientTo: "transparent",
            decimalPlaces: 0,
            color: (opacity = 1) => {
              const baseColor = percentageChange >= 0 ? "#66F2C3" : "#FF8BA7";
              // Convert hex to rgba with higher brightness
              const r = parseInt(baseColor.slice(1, 3), 16);
              const g = parseInt(baseColor.slice(3, 5), 16);
              const b = parseInt(baseColor.slice(5, 7), 16);
              return `rgba(${r}, ${g}, ${b}, ${opacity * 0.95})`; // Increase opacity for better visibility
            },
            labelColor: (opacity = 1) =>
              `rgba(255, 255, 255, ${opacity * 0.8})`, // Increase label visibility
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: "0", // No dots
              strokeWidth: "0",
            },
            propsForBackgroundLines: {
              stroke: "transparent", // No background lines
            },
          }}
          bezier
          style={styles.chart}
          withInnerLines={false} // No inner lines
          withOuterLines={false} // No outer lines
          withVerticalLabels={false} // No vertical labels
          withHorizontalLabels={false} // No horizontal labels
          withDots={false} // No dots
          withShadow={false} // No shadow
          withHorizontalLines={false} // No horizontal lines
          withVerticalLines={false} // No vertical lines
        />
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0C0E1A",
    borderRadius: 24,
    padding: 24,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lastValue: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  changeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  positiveChange: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  negativeChange: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  changeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  gradientBackground: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
    marginVertical: 0,
    paddingRight: 0,
    paddingLeft: 0,
  },
});

export default ModernPortfolioLineChart;
