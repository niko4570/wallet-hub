// Portfolio snapshot management utilities for Solana wallet analysis
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UI_CONFIG } from "../../config/appConfig";

// Extend global type to include snapshotCache
declare global {
  var snapshotCache:
    | {
        snapshots?: Array<{
          timestamp: number;
          totalValueUSD: number;
          version?: number;
        }>;
        lastSnapshotTime?: number;
        lastSnapshotValue?: number;
      }
    | undefined;
}

// Ensure snapshotCache is defined
globalThis.snapshotCache = globalThis.snapshotCache || undefined;

// Key for storing portfolio snapshots in AsyncStorage
const PORTFOLIO_SNAPSHOTS_KEY = "portfolio_snapshots";

// Type definition for portfolio snapshot
export interface PortfolioSnapshot {
  timestamp: number;
  totalValueUSD: number;
  version?: number; // Schema version for future compatibility
}

/**
 * Validates a single portfolio snapshot
 * @param snapshot - Snapshot to validate
 * @returns boolean - True if snapshot is valid
 */
function validateSnapshot(snapshot: any): snapshot is PortfolioSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  // Validate timestamp
  if (
    typeof snapshot.timestamp !== "number" ||
    snapshot.timestamp <= 0 ||
    !Number.isFinite(snapshot.timestamp)
  ) {
    return false;
  }

  // Validate totalValueUSD
  if (
    typeof snapshot.totalValueUSD !== "number" ||
    snapshot.totalValueUSD < 0 ||
    !Number.isFinite(snapshot.totalValueUSD)
  ) {
    return false;
  }

  // Validate version (if present)
  if (
    snapshot.version !== undefined &&
    (typeof snapshot.version !== "number" || snapshot.version < 0)
  ) {
    return false;
  }

  return true;
}

/**
 * Validates an array of portfolio snapshots
 * @param snapshots - Array of snapshots to validate
 * @returns PortfolioSnapshot[] - Array of valid snapshots
 */
function validateSnapshots(snapshots: any): PortfolioSnapshot[] {
  if (!Array.isArray(snapshots)) {
    return [];
  }

  return snapshots.filter(validateSnapshot);
}

/**
 * Saves a portfolio snapshot to AsyncStorage with the following rules:
 * - Only saves if last snapshot is more than configured interval old
 * - Maintains maximum configured retention period of snapshot data
 * - Automatically removes snapshots older than retention period
 * - Limits to maximum configured number of snapshots
 * @param currentTotalUSD - Current total portfolio value in USD
 * @returns Promise<void>
 */
export async function savePortfolioSnapshot(
  currentTotalUSD: number,
): Promise<void> {
  try {
    // Validate input
    if (!Number.isFinite(currentTotalUSD) || currentTotalUSD < 0) {
      console.warn("Invalid currentTotalUSD value:", currentTotalUSD);
      return;
    }

    // Check if we can use the in-memory cache first
    if (globalThis.snapshotCache && globalThis.snapshotCache.lastSnapshotTime) {
      const now = Date.now();
      if (
        now - globalThis.snapshotCache.lastSnapshotTime <
        UI_CONFIG.SNAPSHOT.INTERVAL_MS
      ) {
        console.debug(
          "Snapshot skipped: within configured interval (cache check)",
        );
        return;
      }
    }

    // Retrieve existing snapshots
    const existingSnapshotsJson = await AsyncStorage.getItem(
      PORTFOLIO_SNAPSHOTS_KEY,
    );
    let existingSnapshots: PortfolioSnapshot[] = [];

    if (existingSnapshotsJson) {
      try {
        const parsedSnapshots = JSON.parse(existingSnapshotsJson);
        // Validate parsed data
        existingSnapshots = validateSnapshots(parsedSnapshots);
        if (
          existingSnapshots.length !==
          (Array.isArray(parsedSnapshots) ? parsedSnapshots.length : 0)
        ) {
          console.warn("Some snapshots were invalid and removed");
        }
      } catch (parseError) {
        console.error("Failed to parse existing snapshots:", parseError);
        existingSnapshots = [];
      }
    }

    // Check if we need to save a new snapshot
    const now = Date.now();
    const shouldSaveSnapshot =
      !existingSnapshots.length ||
      now - (existingSnapshots[existingSnapshots.length - 1]?.timestamp || 0) >
        UI_CONFIG.SNAPSHOT.INTERVAL_MS;

    if (!shouldSaveSnapshot) {
      console.debug("Snapshot skipped: within configured interval");
      return;
    }

    // Create new snapshot with version
    const newSnapshot: PortfolioSnapshot = {
      timestamp: now,
      totalValueUSD: currentTotalUSD,
      version: 1, // Schema version
    };

    // Add new snapshot and remove old ones
    const updatedSnapshots = [...existingSnapshots, newSnapshot]
      .filter(
        (snapshot) =>
          now - snapshot.timestamp <= UI_CONFIG.SNAPSHOT.RETENTION_MS,
      )
      .sort((a, b) => a.timestamp - b.timestamp) // Ensure chronological order
      .slice(-UI_CONFIG.SNAPSHOT.MAX_SNAPSHOTS); // Limit to maximum snapshots

    // Save updated snapshots back to AsyncStorage
    await AsyncStorage.setItem(
      PORTFOLIO_SNAPSHOTS_KEY,
      JSON.stringify(updatedSnapshots),
    );

    // Update in-memory cache
    if (!globalThis.snapshotCache) {
      globalThis.snapshotCache = {};
    }
    globalThis.snapshotCache.lastSnapshotTime = now;
    globalThis.snapshotCache.lastSnapshotValue = currentTotalUSD;

    console.debug("Portfolio snapshot saved:", {
      timestamp: newSnapshot.timestamp,
      totalValueUSD: newSnapshot.totalValueUSD,
      totalSnapshots: updatedSnapshots.length,
    });
  } catch (error) {
    console.error("Failed to save portfolio snapshot:", error);
    // Don't throw error - function should fail gracefully
  }
}

/**
 * Retrieves all portfolio snapshots
 * @returns Promise<PortfolioSnapshot[]>
 */
export async function getPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  try {
    // Check if we have cached snapshots
    if (globalThis.snapshotCache && globalThis.snapshotCache.snapshots) {
      console.debug("Using cached snapshots");
      return globalThis.snapshotCache.snapshots;
    }

    const snapshotsJson = await AsyncStorage.getItem(PORTFOLIO_SNAPSHOTS_KEY);
    if (!snapshotsJson) {
      // Update cache with empty array
      if (!globalThis.snapshotCache) {
        globalThis.snapshotCache = {};
      }
      globalThis.snapshotCache.snapshots = [];
      return [];
    }

    const parsedSnapshots = JSON.parse(snapshotsJson);
    const validSnapshots = validateSnapshots(parsedSnapshots);

    if (
      validSnapshots.length !==
      (Array.isArray(parsedSnapshots) ? parsedSnapshots.length : 0)
    ) {
      console.warn("Some snapshots were invalid and removed");
    }

    // Update cache with valid snapshots
    if (!globalThis.snapshotCache) {
      globalThis.snapshotCache = {};
    }
    globalThis.snapshotCache.snapshots = validSnapshots;

    return validSnapshots;
  } catch (error) {
    console.error("Failed to retrieve portfolio snapshots:", error);
    return [];
  }
}

/**
 * Clears all portfolio snapshots
 * @returns Promise<void>
 */
export async function clearPortfolioSnapshots(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PORTFOLIO_SNAPSHOTS_KEY);

    // Clear in-memory cache
    if (globalThis.snapshotCache) {
      delete globalThis.snapshotCache.snapshots;
      delete globalThis.snapshotCache.lastSnapshotTime;
      delete globalThis.snapshotCache.lastSnapshotValue;
    }

    console.debug("Portfolio snapshots cleared");
  } catch (error) {
    console.error("Failed to clear portfolio snapshots:", error);
  }
}

/**
 * Exports portfolio snapshots as JSON string
 * @returns Promise<string> - JSON string of snapshots
 */
export async function exportPortfolioSnapshots(): Promise<string> {
  try {
    const snapshots = await getPortfolioSnapshots();

    // Create export object with metadata
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      snapshots,
      metadata: {
        totalSnapshots: snapshots.length,
        earliestSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : null,
        latestSnapshot:
          snapshots.length > 0
            ? snapshots[snapshots.length - 1].timestamp
            : null,
      },
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error("Failed to export portfolio snapshots:", error);
    throw error;
  }
}

/**
 * Imports portfolio snapshots from JSON string
 * @param jsonString - JSON string of snapshots
 * @param options - Import options
 * @returns Promise<{ success: boolean; importedCount: number; message: string }>
 */
export async function importPortfolioSnapshots(
  jsonString: string,
  options: {
    merge?: boolean; // If true, merge with existing snapshots; if false, replace
  } = { merge: false },
): Promise<{ success: boolean; importedCount: number; message: string }> {
  try {
    // Parse the JSON string
    const importData = JSON.parse(jsonString);

    // Validate import data structure
    if (
      !importData ||
      typeof importData !== "object" ||
      !Array.isArray(importData.snapshots)
    ) {
      return {
        success: false,
        importedCount: 0,
        message: "Invalid import data format",
      };
    }

    // Validate each snapshot
    const validSnapshots = validateSnapshots(importData.snapshots);

    if (validSnapshots.length === 0) {
      return {
        success: false,
        importedCount: 0,
        message: "No valid snapshots found in import data",
      };
    }

    let finalSnapshots: PortfolioSnapshot[];

    if (options.merge) {
      // Get existing snapshots
      const existingSnapshots = await getPortfolioSnapshots();

      // Merge and deduplicate by timestamp
      const allSnapshots = [...existingSnapshots, ...validSnapshots];
      const uniqueSnapshotsMap = new Map<number, PortfolioSnapshot>();

      allSnapshots.forEach((snapshot) => {
        uniqueSnapshotsMap.set(snapshot.timestamp, snapshot);
      });

      finalSnapshots = Array.from(uniqueSnapshotsMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .filter((snapshot) => {
          const now = Date.now();
          return now - snapshot.timestamp <= UI_CONFIG.SNAPSHOT.RETENTION_MS;
        })
        .slice(-UI_CONFIG.SNAPSHOT.MAX_SNAPSHOTS);
    } else {
      // Replace with imported snapshots
      const now = Date.now();
      finalSnapshots = validSnapshots
        .sort((a, b) => a.timestamp - b.timestamp)
        .filter((snapshot) => {
          return now - snapshot.timestamp <= UI_CONFIG.SNAPSHOT.RETENTION_MS;
        })
        .slice(-UI_CONFIG.SNAPSHOT.MAX_SNAPSHOTS);
    }

    // Save the snapshots
    await AsyncStorage.setItem(
      PORTFOLIO_SNAPSHOTS_KEY,
      JSON.stringify(finalSnapshots),
    );

    // Clear cache to force refresh
    if (globalThis.snapshotCache) {
      delete globalThis.snapshotCache.snapshots;
    }

    console.debug("Portfolio snapshots imported:", {
      importedCount: validSnapshots.length,
      finalCount: finalSnapshots.length,
      merge: options.merge,
    });

    return {
      success: true,
      importedCount: validSnapshots.length,
      message: `Successfully imported ${validSnapshots.length} snapshots (${finalSnapshots.length} retained after filtering)`,
    };
  } catch (error) {
    console.error("Failed to import portfolio snapshots:", error);
    return {
      success: false,
      importedCount: 0,
      message:
        error instanceof Error ? error.message : "Failed to import snapshots",
    };
  }
}
