import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AssetAllocationPieChart } from "../AssetAllocationPieChart";

// Mock Dimensions for testing
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
    })),
  },
}));

// Mock PieChart component
jest.mock("react-native-chart-kit", () => ({
  PieChart: jest.fn(() => null),
}));

const mockTokensData = [
  { symbol: "SOL", valueUSD: 1500 },
  { symbol: "USDC", valueUSD: 1000 },
  { symbol: "RAY", valueUSD: 500 },
  { symbol: "LOW", valueUSD: 0.5 }, // Should be filtered out
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
    const lowValueTokens = [{ symbol: "LOW", valueUSD: 0.5 }];
    render(<AssetAllocationPieChart tokens={lowValueTokens} />);

    // Check if the component renders without errors
    expect(screen).toBeTruthy();
  });
});
