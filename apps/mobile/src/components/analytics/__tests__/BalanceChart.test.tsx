import React from "react";
import { render } from "@testing-library/react-native";
import { BalanceChart } from "../BalanceChart";

// Mock react-native-svg since it's not fully supported in testing environment
import { jest, describe, test, expect } from "@jest/globals";

jest.mock("react-native-svg", () => ({
  Svg: ({ children }: any) => <>{children}</>,
  Path: () => null,
  Defs: ({ children }: any) => <>{children}</>,
  LinearGradient: () => null,
  Stop: () => null,
  Circle: () => null,
}));

// Mock Dimensions to avoid issues in testing
jest.mock("react-native", () => ({
  ...(jest.requireActual("react-native") as object),
  Dimensions: {
    get: jest.fn(() => ({
      width: 375,
      height: 812,
    })),
  },
}));

describe("BalanceChart Component", () => {
  const mockData = [
    { timestamp: Date.now() - 3600000, usd: 100, sol: 1 },
    { timestamp: Date.now() - 1800000, usd: 105, sol: 1.05 },
    { timestamp: Date.now(), usd: 110, sol: 1.1 },
  ];

  test("renders loading state correctly", () => {
    const { getByText } = render(<BalanceChart data={[]} loading={true} />);
    expect(getByText("Loading balance history...")).toBeTruthy();
  });

  test("renders error state correctly", () => {
    const errorMessage = "Failed to load balance history";
    const { getByText } = render(
      <BalanceChart data={[]} error={errorMessage} />,
    );
    expect(getByText(errorMessage)).toBeTruthy();
  });

  test("renders empty state correctly", () => {
    const { getByText } = render(<BalanceChart data={[]} />);
    expect(getByText("No balance history data")).toBeTruthy();
  });

  test("renders with data correctly", () => {
    const { getByText } = render(
      <BalanceChart data={mockData} title="Test Balance Chart" />,
    );
    expect(getByText("Test Balance Chart")).toBeTruthy();
  });

  test("renders with timeRange prop", () => {
    const { getByText } = render(
      <BalanceChart
        data={mockData}
        timeRange="7d"
        title="7d Balance History"
      />,
    );
    expect(getByText("7d Balance History")).toBeTruthy();
  });

  test("renders with showSolLine prop", () => {
    const { getByText } = render(
      <BalanceChart
        data={mockData}
        showSolLine={true}
        title="Balance History with SOL Line"
      />,
    );
    expect(getByText("Balance History with SOL Line")).toBeTruthy();
  });
});

// Test data processing functions
describe("BalanceChart Data Processing", () => {
  test("should handle empty data", () => {
    const { getByText } = render(<BalanceChart data={[]} />);
    expect(getByText("No balance history data")).toBeTruthy();
  });

  test("should handle single data point", () => {
    const singleDataPoint = [{ timestamp: Date.now(), usd: 100, sol: 1 }];
    const { getByText } = render(
      <BalanceChart data={singleDataPoint} title="Single Data Point" />,
    );
    expect(getByText("Single Data Point")).toBeTruthy();
  });

  test("should handle multiple data points with 24h time range", () => {
    const multipleDataPoints = Array.from({ length: 24 }, (_, i) => ({
      timestamp: Date.now() - (23 - i) * 3600000,
      usd: 100 + i * 0.5,
      sol: 1 + i * 0.005,
    }));
    const { getByText } = render(
      <BalanceChart
        data={multipleDataPoints}
        timeRange="24h"
        title="24h Balance History"
      />,
    );
    expect(getByText("24h Balance History")).toBeTruthy();
  });

  test("should handle multiple data points with 7d time range", () => {
    const multipleDataPoints = Array.from({ length: 7 }, (_, i) => ({
      timestamp: Date.now() - (6 - i) * 86400000,
      usd: 100 + i * 2,
      sol: 1 + i * 0.02,
    }));
    const { getByText } = render(
      <BalanceChart
        data={multipleDataPoints}
        timeRange="7d"
        title="7d Balance History"
      />,
    );
    expect(getByText("7d Balance History")).toBeTruthy();
  });

  test("should handle multiple data points with 30d time range", () => {
    const multipleDataPoints = Array.from({ length: 30 }, (_, i) => ({
      timestamp: Date.now() - (29 - i) * 86400000,
      usd: 100 + i * 0.5,
      sol: 1 + i * 0.005,
    }));
    const { getByText } = render(
      <BalanceChart
        data={multipleDataPoints}
        timeRange="30d"
        title="30d Balance History"
      />,
    );
    expect(getByText("30d Balance History")).toBeTruthy();
  });
});
