import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

interface Token {
  symbol: string;
  valueUSD: number;
}

interface AssetAllocationPieChartProps {
  tokens: Token[];
}

const AssetAllocationPieChart: React.FC<AssetAllocationPieChartProps> = ({ tokens }) => {
  const filteredTokens = tokens.filter(token => token.valueUSD >= 1);

  const generateSoftColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 60%, 70%)`;
  };

  const chartData = filteredTokens.map(token => ({
    name: token.symbol,
    population: token.valueUSD,
    color: generateSoftColor(),
    legendFontColor: '#ffffff',
    legendFontSize: 12
  }));

  const screenWidth = Dimensions.get('window').width;

  if (filteredTokens.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No assets with value ≥ $1</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Asset Allocation</Text>
      <PieChart
        data={chartData}
        width={screenWidth - 32}
        height={220}
        chartConfig={{
          backgroundColor: '#050814',
          backgroundGradientFrom: '#050814',
          backgroundGradientTo: '#050814',
          decimalPlaces: 0,
          color: (opacity) => `rgba(255, 255, 255, ${opacity || 1})`,
          labelColor: (opacity) => `rgba(255, 255, 255, ${opacity || 1})`
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute={false}
        hasLegend={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0E1A',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    paddingVertical: 40,
  },
});

export { AssetAllocationPieChart };
