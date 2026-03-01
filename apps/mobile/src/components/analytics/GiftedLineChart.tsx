import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { formatPercentChange } from '../../utils';
import { CHART_CONFIG, COLORS } from '../../config/appConfig';

interface PortfolioHistoryItem {
  timestamp: number;
  totalValueUSD: number;
}

interface GiftedLineChartProps {
  history: PortfolioHistoryItem[];
}

const GiftedLineChart: React.FC<GiftedLineChartProps> = ({ history }) => {
  const hasData = history.length >= 1;

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

  const formatUSD = useMemo(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (value: number): string => formatter.format(value);
  }, []);

  const chartData = useMemo(() => {
    const sortedHistory = [...history].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    let processedData = sortedHistory
      .map((item) => ({
        value: item.totalValueUSD,
        timestamp: item.timestamp,
      }))
      .filter(
        (item) =>
          item.value !== null &&
          item.value !== undefined &&
          !isNaN(item.value) &&
          item.value > 0,
      );

    const values = processedData.map((item) => item.value);
    if (values.length > 4) {
      const sortedValues = [...values].sort((a, b) => a - b);
      const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
      const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      processedData = processedData.filter(
        (item) => item.value >= lowerBound && item.value <= upperBound,
      );
    }

    return processedData;
  }, [history]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const max = Math.max(...chartData.map((item) => item.value));
    return max * 1.01;
  }, [chartData]);



  const pointerLabelComponent = (items: any[]) => {
    const item = items[0];
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.pointerLabel}>
        <Text style={styles.pointerDate}>{dateStr}</Text>
        <View style={styles.pointerValueContainer}>
          <Text style={styles.pointerValue}>{formatUSD(item.value)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
            {formatPercentChange(percentageChange)}
          </Text>
        </View>
      </View>

      <View style={styles.chartFrame}>
        {hasData ? (
          <View style={styles.glowWrapper}>
            <LineChart
              data={chartData}
              areaChart
              curved
              isAnimated
              animationDuration={800}
              hideDataPoints
              spacing={10}
              thickness={3}
              color={COLORS.GREEN}
              startFillColor={COLORS.GREEN_LIGHT}
              endFillColor="rgba(76, 175, 80, 0.01)"
              startOpacity={0.3}
              endOpacity={0.01}
              initialSpacing={0}
              height={CHART_CONFIG.CHART_HEIGHT}
              maxValue={maxValue}
              noOfSections={4}
              hideRules
              hideYAxisText
              yAxisColor="transparent"
              yAxisThickness={0}
              xAxisColor="transparent"
              xAxisThickness={0}
              width={undefined}
              adjustToWidth
              pointerConfig={{
                pointerStripHeight: CHART_CONFIG.CHART_HEIGHT,
                pointerStripColor: COLORS.GREEN,
                pointerStripWidth: 1,
                pointerColor: COLORS.GREEN,
                radius: 6,
                pointerLabelWidth: 100,
                pointerLabelHeight: 80,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent,
                activatePointersOnLongPress: false,
                activatePointersInstantlyOnTouch: true,
                pointerVanishDelay: 150,
              }}
            />
          </View>
        ) : (
          <View style={[styles.emptyState, { height: CHART_CONFIG.CHART_HEIGHT }]}>
            <Text style={styles.emptyStateText}>Not enough data yet</Text>
          </View>
        )}
      </View>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  lastValue: {
    fontSize: 30,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  changeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  positiveChange: {
    backgroundColor: COLORS.GREEN_LIGHT,
  },
  negativeChange: {
    backgroundColor: COLORS.RED_LIGHT,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  chartFrame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 0.3,
  },
  pointerLabel: {
    height: 80,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointerDate: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  pointerValueContainer: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.BACKGROUND,
  },
  pointerValue: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
  },
});

export default GiftedLineChart;
export { GiftedLineChart };
