// Tests for portfolio snapshot management utilities
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  savePortfolioSnapshot,
  getPortfolioSnapshots,
  clearPortfolioSnapshots,
  PortfolioSnapshot,
} from "../portfolio/snapshot";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("portfolioSnapshot utilities", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear global cache before each test
    if (globalThis.snapshotCache) {
      delete globalThis.snapshotCache;
    }
    // Mock Date.now for consistent testing
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers after each test
    jest.useRealTimers();
  });

  describe("savePortfolioSnapshot", () => {
    it("should save a new snapshot when no previous snapshots exist", async () => {
      // Mock no existing snapshots
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Set current time
      const now = Date.now();

      // Call the function
      await savePortfolioSnapshot(1500.75);

      // Verify AsyncStorage operations
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
        JSON.stringify([
          { timestamp: now, totalValueUSD: 1500.75, version: 1 },
        ]),
      );
    });

    it("should save a new snapshot when last snapshot is more than 1 hour old", async () => {
      // Create mock existing snapshots
      const oneHourAndOneMinuteAgo = Date.now() - 3660000; // 1h 1m ago
      const existingSnapshots: PortfolioSnapshot[] = [
        { timestamp: oneHourAndOneMinuteAgo, totalValueUSD: 1450.25 },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(existingSnapshots),
      );

      const now = Date.now();

      await savePortfolioSnapshot(1500.75);

      const expectedSnapshots = [
        ...existingSnapshots,
        { timestamp: now, totalValueUSD: 1500.75, version: 1 },
      ];

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
        JSON.stringify(expectedSnapshots),
      );
    });

    it("should not save a new snapshot when last snapshot is less than 1 hour old", async () => {
      // Create mock existing snapshots
      const thirtyMinutesAgo = Date.now() - 1800000; // 30m ago
      const existingSnapshots: PortfolioSnapshot[] = [
        { timestamp: thirtyMinutesAgo, totalValueUSD: 1450.25 },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(existingSnapshots),
      );

      await savePortfolioSnapshot(1500.75);

      // Should not call setItem
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it("should remove snapshots older than 90 days", async () => {
      // Create mock existing snapshots
      const now = Date.now();
      const ninetyOneDaysAgo = now - 91 * 24 * 60 * 60 * 1000; // 91 days ago
      const oneHourAndOneMinuteAgo = now - 3660000; // 1h 1m ago - more than 1 hour

      const existingSnapshots: PortfolioSnapshot[] = [
        { timestamp: ninetyOneDaysAgo, totalValueUSD: 1300.0 }, // Should be removed
        { timestamp: oneHourAndOneMinuteAgo, totalValueUSD: 1450.25 },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(existingSnapshots),
      );

      await savePortfolioSnapshot(1500.75);

      const expectedSnapshots = [
        existingSnapshots[1], // Keep the 1h 1m ago snapshot
        { timestamp: now, totalValueUSD: 1500.75, version: 1 }, // Add new snapshot
      ];

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
        JSON.stringify(expectedSnapshots),
      );
    });

    it("should handle invalid existing snapshots data", async () => {
      // Mock invalid existing snapshots
      mockAsyncStorage.getItem.mockResolvedValue("invalid json");

      const now = Date.now();

      await savePortfolioSnapshot(1500.75);

      // Should create new snapshot collection
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
        JSON.stringify([
          { timestamp: now, totalValueUSD: 1500.75, version: 1 },
        ]),
      );
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      // Mock AsyncStorage error
      mockAsyncStorage.getItem.mockRejectedValue(
        new Error("AsyncStorage error"),
      );

      // Should not throw error
      await expect(savePortfolioSnapshot(1500.75)).resolves.not.toThrow();
    });

    it("should skip saving when currentTotalUSD is invalid", async () => {
      await savePortfolioSnapshot(-100); // Negative value
      await savePortfolioSnapshot(NaN); // NaN value

      // Should not call any AsyncStorage methods
      expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
      expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("getPortfolioSnapshots", () => {
    it("should return empty array when no snapshots exist", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await getPortfolioSnapshots();

      expect(result).toEqual([]);
    });

    it("should return existing snapshots", async () => {
      const mockSnapshots: PortfolioSnapshot[] = [
        { timestamp: Date.now() - 3600000, totalValueUSD: 1450.25 },
        { timestamp: Date.now(), totalValueUSD: 1500.75 },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockSnapshots));

      // Clear cache before test
      if (globalThis.snapshotCache) {
        delete globalThis.snapshotCache.snapshots;
      }

      const result = await getPortfolioSnapshots();

      // Check that result contains the same data (ignoring version field which might be added)
      expect(result).toHaveLength(mockSnapshots.length);
      result.forEach((snapshot, index) => {
        expect(snapshot.timestamp).toBe(mockSnapshots[index].timestamp);
        expect(snapshot.totalValueUSD).toBe(mockSnapshots[index].totalValueUSD);
      });
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(
        new Error("AsyncStorage error"),
      );

      const result = await getPortfolioSnapshots();

      expect(result).toEqual([]);
    });
  });

  describe("clearPortfolioSnapshots", () => {
    it("should clear all snapshots", async () => {
      await clearPortfolioSnapshots();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "portfolio_snapshots",
      );
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(
        new Error("AsyncStorage error"),
      );

      // Should not throw error
      await expect(clearPortfolioSnapshots()).resolves.not.toThrow();
    });
  });
});
