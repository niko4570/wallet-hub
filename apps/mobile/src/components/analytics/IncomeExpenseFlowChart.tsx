import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Transaction } from "../../types";
import { formatAmount } from "../../utils";
import { Feather } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";

interface IncomeExpenseFlowChartProps {
  transactions: Transaction[];
  linkedWalletAddresses: string[];
  days?: number;
}

type DailyFlow = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayKey = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const formatDayLabel = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
};

export const IncomeExpenseFlowChart: React.FC<IncomeExpenseFlowChartProps> = ({
  transactions,
  linkedWalletAddresses,
  days = 7,
}) => {
  const [selectedRange, setSelectedRange] = useState<7 | 30>(
    days >= 30 ? 30 : 7,
  );

  const dailyFlow = useMemo<DailyFlow[]>(() => {
    const activeDays = selectedRange;
    const now = Date.now();
    const start = now - (activeDays - 1) * DAY_MS;

    const dayBuckets = new Map<string, DailyFlow>();
    for (let i = 0; i < activeDays; i += 1) {
      const ts = start + i * DAY_MS;
      const key = toDayKey(ts);
      dayBuckets.set(key, {
        key,
        label: formatDayLabel(key),
        income: 0,
        expense: 0,
      });
    }

    transactions.forEach((transaction) => {
      const parsedTs = new Date(transaction.timestamp).getTime();
      if (!Number.isFinite(parsedTs) || parsedTs < start) {
        return;
      }

      if (transaction.amountUnit && transaction.amountUnit !== "SOL") {
        return;
      }

      const amount =
        typeof transaction.amount === "number" &&
        Number.isFinite(transaction.amount)
          ? Math.max(0, transaction.amount)
          : 0;

      if (amount <= 0) {
        return;
      }

      const dayKey = toDayKey(parsedTs);
      const bucket = dayBuckets.get(dayKey);
      if (!bucket) {
        return;
      }

      const isOutbound = linkedWalletAddresses.includes(transaction.source);
      const isInbound = linkedWalletAddresses.includes(transaction.destination);

      if (isOutbound && !isInbound) {
        bucket.expense += amount;
      } else if (isInbound && !isOutbound) {
        bucket.income += amount;
      }
    });

    return Array.from(dayBuckets.values());
  }, [linkedWalletAddresses, selectedRange, transactions]);

  const maxValue = useMemo(() => {
    const values = dailyFlow.flatMap((entry) => [entry.income, entry.expense]);
    const max = Math.max(...values, 0);
    return max > 0 ? max : 1;
  }, [dailyFlow]);

  const totalIncome = useMemo(
    () => dailyFlow.reduce((sum, day) => sum + day.income, 0),
    [dailyFlow],
  );
  const totalExpense = useMemo(
    () => dailyFlow.reduce((sum, day) => sum + day.expense, 0),
    [dailyFlow],
  );

  const netFlowSeries = useMemo(() => {
    const total = dailyFlow.length;

    return dailyFlow.map((entry, index) => ({
      value: Number((entry.income - entry.expense).toFixed(4)),
      label:
        selectedRange === 30 && index % 3 !== 0 && index !== total - 1
          ? ""
          : entry.label,
    }));
  }, [dailyFlow, selectedRange]);

  const maxAbsNetFlow = useMemo(() => {
    const maxAbs = netFlowSeries.reduce(
      (max, point) => Math.max(max, Math.abs(point.value)),
      0,
    );
    return maxAbs > 0 ? maxAbs * 1.15 : 1;
  }, [netFlowSeries]);

  const totalNetFlow = useMemo(
    () => totalIncome - totalExpense,
    [totalExpense, totalIncome],
  );

  const { width: screenWidth } = Dimensions.get("window");
  const chartWidth = Math.max(220, screenWidth - 86);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Feather name="bar-chart-2" size={14} color="#FFFFFF" />
          <Text style={styles.title}>Income vs Expense ({selectedRange}D)</Text>
        </View>
        <View style={styles.rangeSwitch}>
          <TouchableOpacity
            style={[
              styles.rangeButton,
              selectedRange === 7 && styles.rangeButtonActive,
            ]}
            onPress={() => setSelectedRange(7)}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selectedRange === 7 && styles.rangeButtonTextActive,
              ]}
            >
              7D
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.rangeButton,
              selectedRange === 30 && styles.rangeButtonActive,
            ]}
            onPress={() => setSelectedRange(30)}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selectedRange === 30 && styles.rangeButtonTextActive,
              ]}
            >
              30D
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.summary}>
        +{formatAmount(totalIncome)} / -{formatAmount(totalExpense)} SOL
      </Text>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.incomeDot]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.expenseDot]} />
          <Text style={styles.legendText}>Expense</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.netFlowDot]} />
          <Text style={styles.legendText}>Net Flow</Text>
        </View>
      </View>

      <View style={styles.netFlowCard}>
        <View style={styles.netFlowHeader}>
          <Text style={styles.netFlowTitle}>Net Inflow Curve</Text>
          <Text
            style={[
              styles.netFlowValue,
              totalNetFlow >= 0
                ? styles.netFlowPositive
                : styles.netFlowNegative,
            ]}
          >
            {totalNetFlow >= 0 ? "+" : "-"}
            {formatAmount(Math.abs(totalNetFlow))} SOL
          </Text>
        </View>

        <LineChart
          data={netFlowSeries}
          width={chartWidth}
          height={90}
          spacing={Math.max(
            6,
            Math.floor(chartWidth / Math.max(1, selectedRange - 1)),
          )}
          initialSpacing={0}
          thickness={2.5}
          color={totalNetFlow >= 0 ? "#00FFB3" : "#FF4D4D"}
          hideDataPoints
          curved
          isAnimated
          animationDuration={500}
          noOfSections={4}
          maxValue={maxAbsNetFlow}
          mostNegativeValue={maxAbsNetFlow}
          hideYAxisText
          yAxisColor="transparent"
          yAxisThickness={0}
          xAxisColor="transparent"
          xAxisThickness={0}
          hideRules
          areaChart
          startFillColor={
            totalNetFlow >= 0
              ? "rgba(0, 255, 179, 0.18)"
              : "rgba(255, 77, 77, 0.18)"
          }
          endFillColor="rgba(255, 255, 255, 0.01)"
          startOpacity={0.18}
          endOpacity={0.01}
        />
      </View>

      <View style={styles.rows}>
        {dailyFlow.map((entry, index) => {
          const incomeRatio = entry.income / maxValue;
          const expenseRatio = entry.expense / maxValue;
          const label =
            selectedRange === 30 &&
            index % 3 !== 0 &&
            index !== dailyFlow.length - 1
              ? ""
              : entry.label;

          return (
            <View key={entry.key} style={styles.row}>
              <Text style={styles.dayLabel}>{label}</Text>
              <View style={styles.barsWrap}>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      styles.incomeBar,
                      { width: `${Math.max(4, incomeRatio * 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      styles.expenseBar,
                      { width: `${Math.max(4, expenseRatio * 100)}%` },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.valueText}>
                +{formatAmount(entry.income)} / -{formatAmount(entry.expense)}
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
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  summary: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
  },
  rangeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  rangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rangeButtonActive: {
    backgroundColor: "rgba(127, 86, 217, 0.35)",
  },
  rangeButtonText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  rangeButtonTextActive: {
    color: "#FFFFFF",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
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
  incomeDot: {
    backgroundColor: "#00FFB3",
  },
  expenseDot: {
    backgroundColor: "#FF4D4D",
  },
  netFlowDot: {
    backgroundColor: "#7F56D9",
  },
  legendText: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
  },
  netFlowCard: {
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  netFlowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  netFlowTitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
  netFlowValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  netFlowPositive: {
    color: "#00FFB3",
  },
  netFlowNegative: {
    color: "#FF4D4D",
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayLabel: {
    width: 34,
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 11,
    fontWeight: "600",
  },
  barsWrap: {
    flex: 1,
    marginHorizontal: 10,
    gap: 4,
  },
  track: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 4,
  },
  incomeBar: {
    backgroundColor: "#00FFB3",
  },
  expenseBar: {
    backgroundColor: "#FF4D4D",
  },
  valueText: {
    width: 96,
    textAlign: "right",
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10,
    fontWeight: "500",
  },
});

export default IncomeExpenseFlowChart;
