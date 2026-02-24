// Tests for portfolio performance calculation utilities
import {
  calculatePortfolioChangePercent,
  filterHistoricalDataByRange,
} from "../portfolioPerformance";

describe("portfolioPerformance utilities", () => {
  describe("calculatePortfolioChangePercent", () => {
    // Mock current timestamp for consistent testing
    const mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC
    const originalNow = Date.now;

    beforeAll(() => {
      (Date.now as jest.Mock) = jest.fn(() => mockNow);
    });

    afterAll(() => {
      (Date.now as jest.Mock) = originalNow as jest.Mock;
    });

    // Test data
    const mockHistoricalSnapshots = [
      { timestamp: mockNow - 30 * 24 * 60 * 60 * 1000, totalValueUSD: 1000 }, // 30 days ago
      { timestamp: mockNow - 7 * 24 * 60 * 60 * 1000, totalValueUSD: 1200 }, // 7 days ago
      { timestamp: mockNow - 1 * 24 * 60 * 60 * 1000, totalValueUSD: 1500 }, // 1 day ago
      { timestamp: mockNow - 12 * 60 * 60 * 1000, totalValueUSD: 1400 }, // 12 hours ago
    ];

    it("should calculate correct percentage change for 1D range", () => {
      const result = calculatePortfolioChangePercent(
        1600,
        mockHistoricalSnapshots,
        "1D",
      );
      // Expected: ((1600 - 1500) / 1500) * 100 = 6.67
      expect(result).toBe(6.67);
    });

    it("should calculate correct percentage change for 7D range", () => {
      const result = calculatePortfolioChangePercent(
        1600,
        mockHistoricalSnapshots,
        "7D",
      );
      // Expected: ((1600 - 1200) / 1200) * 100 = 33.33
      expect(result).toBe(33.33);
    });

    it("should calculate correct percentage change for 30D range", () => {
      const result = calculatePortfolioChangePercent(
        1600,
        mockHistoricalSnapshots,
        "30D",
      );
      // Expected: ((1600 - 1000) / 1000) * 100 = 60
      expect(result).toBe(60);
    });

    it("should handle negative percentage change", () => {
      const result = calculatePortfolioChangePercent(
        1400,
        mockHistoricalSnapshots,
        "1D",
      );
      // Expected: ((1400 - 1500) / 1500) * 100 = -6.67
      expect(result).toBe(-6.67);
    });

    it("should handle zero percentage change", () => {
      const result = calculatePortfolioChangePercent(
        1500,
        mockHistoricalSnapshots,
        "1D",
      );
      // Expected: ((1500 - 1500) / 1500) * 100 = 0
      expect(result).toBe(0);
    });

    it("should return 0 for empty historical snapshots array", () => {
      const result = calculatePortfolioChangePercent(1600, [], "1D");
      expect(result).toBe(0);
    });

    it("should return 0 for previous total value of zero", () => {
      const snapshotsWithZeroValue = [
        { timestamp: mockNow - 1 * 24 * 60 * 60 * 1000, totalValueUSD: 0 },
      ];
      const result = calculatePortfolioChangePercent(
        1600,
        snapshotsWithZeroValue,
        "1D",
      );
      expect(result).toBe(0);
    });

    it("should return 0 for negative previous total value", () => {
      const snapshotsWithNegativeValue = [
        { timestamp: mockNow - 1 * 24 * 60 * 60 * 1000, totalValueUSD: -100 },
      ];
      const result = calculatePortfolioChangePercent(
        1600,
        snapshotsWithNegativeValue,
        "1D",
      );
      expect(result).toBe(0);
    });

    it("should return 0 for invalid current total USD", () => {
      const result = calculatePortfolioChangePercent(
        NaN,
        mockHistoricalSnapshots,
        "1D",
      );
      expect(result).toBe(0);
    });

    it("should return 0 for negative current total USD", () => {
      const result = calculatePortfolioChangePercent(
        -100,
        mockHistoricalSnapshots,
        "1D",
      );
      expect(result).toBe(0);
    });

    it("should find closest snapshot when exact timestamp not available", () => {
      const sparseSnapshots = [
        { timestamp: mockNow - 1.5 * 24 * 60 * 60 * 1000, totalValueUSD: 1300 }, // 36 hours ago
        { timestamp: mockNow - 0.5 * 24 * 60 * 60 * 1000, totalValueUSD: 1450 }, // 12 hours ago
      ];
      const result = calculatePortfolioChangePercent(
        1600,
        sparseSnapshots,
        "1D",
      );
      // Should use the 12-hour ago snapshot (closest to 24-hour target)
      expect(result).toBeCloseTo(10.34, 2); // ((1600 - 1450) / 1450) * 100
    });
  });

  describe("filterHistoricalDataByRange", () => {
    // Mock current timestamp for consistent testing
    const mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC
    const originalNow = Date.now;

    beforeAll(() => {
      (Date.now as jest.Mock) = jest.fn(() => mockNow);
    });

    afterAll(() => {
      (Date.now as jest.Mock) = originalNow as jest.Mock;
    });

    it("should filter data for 1 day range", () => {
      const testData = [
        { timestamp: mockNow - 2 * 24 * 60 * 60 * 1000, totalValueUSD: 1000 }, // 2 days ago
        { timestamp: mockNow - 1 * 24 * 60 * 60 * 1000, totalValueUSD: 1200 }, // 1 day ago
        { timestamp: mockNow - 12 * 60 * 60 * 1000, totalValueUSD: 1400 }, // 12 hours ago
      ];

      const result = filterHistoricalDataByRange(testData, 1);
      expect(result).toHaveLength(2);
      expect(result[0].totalValueUSD).toBe(1200);
      expect(result[1].totalValueUSD).toBe(1400);
    });

    it("should return empty array for no matching data", () => {
      const testData = [
        { timestamp: mockNow - 2 * 24 * 60 * 60 * 1000, totalValueUSD: 1000 }, // 2 days ago
      ];

      const result = filterHistoricalDataByRange(testData, 1);
      expect(result).toHaveLength(0);
    });

    it("should return empty array for invalid input", () => {
      const result = filterHistoricalDataByRange(null as any, 1);
      expect(result).toHaveLength(0);
    });

    it("should sort results by timestamp", () => {
      const unsortedData = [
        { timestamp: mockNow - 12 * 60 * 60 * 1000, totalValueUSD: 1400 }, // 12 hours ago
        { timestamp: mockNow - 1 * 24 * 60 * 60 * 1000, totalValueUSD: 1200 }, // 1 day ago
      ];

      const result = filterHistoricalDataByRange(unsortedData, 1);
      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBeLessThan(result[1].timestamp);
    });
  });
});
