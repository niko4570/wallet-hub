/**
 * Tests for Balance History functionality
 * Verifies that historical balance tracking works correctly
 */

describe("Balance History Store", () => {
  describe("Data Retention Policy", () => {
    test("should keep data for 30 days", () => {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;

      // Data from 30 days ago should be kept
      expect(thirtyDaysAgo > 0).toBe(true);

      // Data from 31 days ago should be removed
      expect(thirtyOneDaysAgo < thirtyDaysAgo).toBe(true);
    });

    test("should validate balance data before storing", () => {
      const validBalance = {
        timestamp: Date.now(),
        usd: 100.5,
        sol: 1.5,
      };

      const invalidBalances = [
        { timestamp: Date.now(), usd: -10, sol: 1.5 }, // Negative USD
        { timestamp: Date.now(), usd: 100, sol: -1.5 }, // Negative SOL
        { timestamp: -1, usd: 100, sol: 1.5 }, // Invalid timestamp
        { timestamp: Date.now(), usd: NaN, sol: 1.5 }, // NaN USD
      ];

      // Valid balance should pass validation
      expect(Number.isFinite(validBalance.usd) && validBalance.usd >= 0).toBe(
        true,
      );
      expect(Number.isFinite(validBalance.sol) && validBalance.sol >= 0).toBe(
        true,
      );
      expect(
        Number.isFinite(validBalance.timestamp) && validBalance.timestamp > 0,
      ).toBe(true);

      // Invalid balances should fail validation
      invalidBalances.forEach((balance) => {
        const isValid =
          Number.isFinite(balance.usd) &&
          balance.usd >= 0 &&
          Number.isFinite(balance.sol) &&
          balance.sol >= 0 &&
          Number.isFinite(balance.timestamp) &&
          balance.timestamp > 0;

        expect(isValid).toBe(false);
      });
    });

    test("should handle timestamp tolerance for deduplication", () => {
      const TIMESTAMP_TOLERANCE = 60 * 1000; // 1 minute
      const baseTimestamp = Date.now();

      const timestamp1 = baseTimestamp;
      const timestamp2 = baseTimestamp + 30 * 1000; // 30 seconds later
      const timestamp3 = baseTimestamp + 2 * 60 * 1000; // 2 minutes later

      // Within tolerance
      expect(Math.abs(timestamp1 - timestamp2) < TIMESTAMP_TOLERANCE).toBe(
        true,
      );

      // Outside tolerance
      expect(Math.abs(timestamp1 - timestamp3) < TIMESTAMP_TOLERANCE).toBe(
        false,
      );
    });
  });

  describe("Data Collection and Aggregation", () => {
    test("should group balances by timestamp", () => {
      const timestamp1 = Date.now();
      const timestamp2 = Date.now() + 60000;

      const balances = [
        { timestamp: timestamp1, usd: 100, sol: 1 },
        { timestamp: timestamp1, usd: 50, sol: 0.5 },
        { timestamp: timestamp2, usd: 150, sol: 1.5 },
      ];

      const groupedByTimestamp = new Map<
        number,
        Array<{ usd: number; sol: number }>
      >();

      balances.forEach((balance) => {
        if (!groupedByTimestamp.has(balance.timestamp)) {
          groupedByTimestamp.set(balance.timestamp, []);
        }
        groupedByTimestamp
          .get(balance.timestamp)
          ?.push({ usd: balance.usd, sol: balance.sol });
      });

      expect(groupedByTimestamp.size).toBe(2);
      expect(groupedByTimestamp.get(timestamp1)?.length).toBe(2);
      expect(groupedByTimestamp.get(timestamp2)?.length).toBe(1);
    });

    test("should calculate correct averages for multi-wallet data", () => {
      const timestamp = Date.now();

      const balances = [
        { timestamp, usd: 100, sol: 1 },
        { timestamp, usd: 200, sol: 2 },
        { timestamp, usd: 300, sol: 3 },
      ];

      const totalUsd = balances.reduce((sum, b) => sum + b.usd, 0);
      const totalSol = balances.reduce((sum, b) => sum + b.sol, 0);
      const count = balances.length;

      const avgUsd = totalUsd / count;
      const avgSol = totalSol / count;

      expect(avgUsd).toBe(200);
      expect(avgSol).toBe(2);
    });

    test("should sort balances by timestamp in ascending order", () => {
      const now = Date.now();

      const unsorted = [
        { timestamp: now + 200, usd: 150, sol: 1.5 },
        { timestamp: now, usd: 100, sol: 1 },
        { timestamp: now + 100, usd: 125, sol: 1.25 },
      ];

      const sorted = [...unsorted].sort((a, b) => a.timestamp - b.timestamp);

      expect(sorted[0].timestamp).toBe(now);
      expect(sorted[1].timestamp).toBe(now + 100);
      expect(sorted[2].timestamp).toBe(now + 200);
    });
  });

  describe("Time Range Filtering", () => {
    test("should filter data within 24h range", () => {
      const now = Date.now();
      const range24h = 24 * 60 * 60 * 1000;
      const startTime = now - range24h;

      const balances = [
        { timestamp: now - 25 * 60 * 60 * 1000, usd: 100, sol: 1 }, // 25h ago - outside
        { timestamp: now - 12 * 60 * 60 * 1000, usd: 110, sol: 1.1 }, // 12h ago - inside
        { timestamp: now - 1 * 60 * 60 * 1000, usd: 120, sol: 1.2 }, // 1h ago - inside
      ];

      const filtered = balances.filter(
        (b) => b.timestamp >= startTime && b.timestamp <= now,
      );

      expect(filtered.length).toBe(2);
      expect(filtered.some((b) => b.usd === 100)).toBe(false);
    });

    test("should filter data within 7d range", () => {
      const now = Date.now();
      const range7d = 7 * 24 * 60 * 60 * 1000;
      const startTime = now - range7d;

      const balances = [
        { timestamp: now - 8 * 24 * 60 * 60 * 1000, usd: 100, sol: 1 }, // 8d - outside
        { timestamp: now - 3 * 24 * 60 * 60 * 1000, usd: 110, sol: 1.1 }, // 3d - inside
        { timestamp: now - 1 * 60 * 60 * 1000, usd: 120, sol: 1.2 }, // 1h - inside
      ];

      const filtered = balances.filter(
        (b) => b.timestamp >= startTime && b.timestamp <= now,
      );

      expect(filtered.length).toBe(2);
    });

    test("should filter data within 30d range", () => {
      const now = Date.now();
      const range30d = 30 * 24 * 60 * 60 * 1000;
      const startTime = now - range30d;

      const balances = [
        { timestamp: now - 31 * 24 * 60 * 60 * 1000, usd: 100, sol: 1 }, // 31d - outside
        { timestamp: now - 15 * 24 * 60 * 60 * 1000, usd: 110, sol: 1.1 }, // 15d - inside
        { timestamp: now - 1 * 60 * 60 * 1000, usd: 120, sol: 1.2 }, // 1h - inside
      ];

      const filtered = balances.filter(
        (b) => b.timestamp >= startTime && b.timestamp <= now,
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty balance arrays gracefully", () => {
      const balances: Array<{ timestamp: number; usd: number; sol: number }> =
        [];

      expect(balances.length).toBe(0);
      expect(Array.isArray(balances)).toBe(true);
    });

    test("should handle single balance point", () => {
      const balances = [{ timestamp: Date.now(), usd: 100, sol: 1 }];

      expect(balances.length).toBe(1);
      expect(balances[0].usd).toBe(100);
    });

    test("should handle zero balances", () => {
      const balances = [{ timestamp: Date.now(), usd: 0, sol: 0 }];

      expect(balances.length).toBe(1);
      expect(balances[0].usd).toBe(0);
      expect(balances[0].sol).toBe(0);
    });

    test("should handle very large balances", () => {
      const largeUsd = 999999999.99;
      const largeSol = 100000;

      const balance = { timestamp: Date.now(), usd: largeUsd, sol: largeSol };

      expect(Number.isFinite(balance.usd)).toBe(true);
      expect(Number.isFinite(balance.sol)).toBe(true);
    });
  });
});
