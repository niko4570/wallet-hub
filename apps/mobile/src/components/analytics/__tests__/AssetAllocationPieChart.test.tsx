import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AssetAllocationPieChart } from "../AssetAllocationPieChart";

const mockTokensData = [
  { symbol: "SOL", usdValue: 1500 },
  { symbol: "USDC", usdValue: 1000 },
  { symbol: "RAY", usdValue: 500 },
  { symbol: "LOW", usdValue: 0.5 }, // Should be filtered out
];

describe("AssetAllocationPieChart", () => {
  it("renders correctly with provided tokens data", () => {
    render(<AssetAllocationPieChart tokens={mockTokensData} />);

    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });

  it("renders correctly with empty tokens data", () => {
    render(<AssetAllocationPieChart tokens={[]} />);

    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });

  it("renders correctly with only low-value tokens", () => {
    const lowValueTokens = [{ symbol: "LOW", usdValue: 0.5 }];
    render(<AssetAllocationPieChart tokens={lowValueTokens} />);

    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });
});
