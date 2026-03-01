import React from "react";
import { GiftedPieChart } from "./GiftedPieChart";

interface Token {
  symbol: string;
  usdValue: number;
}

interface AssetAllocationPieChartProps {
  tokens: Token[];
  loading?: boolean;
  error?: string;
  showLegend?: boolean;
}

const AssetAllocationPieChart: React.FC<AssetAllocationPieChartProps> = ({
  tokens,
  loading,
  error,
  showLegend,
}) => {
  return (
    <GiftedPieChart
      tokens={tokens}
      loading={loading}
      error={error}
      showLegend={showLegend}
    />
  );
};

export { AssetAllocationPieChart };
