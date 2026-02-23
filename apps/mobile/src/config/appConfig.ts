// Application configuration

// Network fees
export const NETWORK_FEES = {
  SOLANA: 0.000005, // SOL network fee
  MAX_AMOUNT: 100000, // Maximum amount of SOL that can be sent
};

// Time range options for charts
export const TIME_RANGE_OPTIONS = {
  OPTIONS: ["1D", "7D", "30D"] as const,
  DEFAULT: "7D" as const,
  LABELS: {
    "1D": "1 Day",
    "7D": "7 Days",
    "30D": "30 Days",
  },
};

// Chart configuration
export const CHART_CONFIG = {
  HISTORY_RETENTION_DAYS: 30, // Keep historical data for 30 days
  CHART_HEIGHT: 240, // Chart height in pixels
  ANIMATION_DURATION: 500, // Animation duration in milliseconds
  TIMESTAMP_TOLERANCE: 60 * 1000, // 1 minute tolerance for duplicate timestamps
};

// UI configuration
export const UI_CONFIG = {
  // Spacing
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
  },
  
  // Border radius
  BORDER_RADIUS: {
    SM: 8,
    MD: 12,
    LG: 16,
    XL: 24,
  },
  
  // Shadow configuration
  SHADOW: {
    LIGHT: {
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    MEDIUM: {
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
  },
  
  // Modal configuration
  MODAL: {
    MIN_HEIGHT: "70%",
    MAX_HEIGHT: "95%",
    PADDING_BOTTOM: 100, // Extra padding to ensure content is visible above buttons
  },
  
  // Bottom space for scroll views
  BOTTOM_SPACE: 48,
};

// Animation configuration
export const ANIMATION_CONFIG = {
  SPRING: {
    damping: 10,
    stiffness: 100,
  },
  TIMING: {
    SHORT: 300,
    MEDIUM: 500,
    LONG: 800,
  },
};

// Validation configuration
export const VALIDATION_CONFIG = {
  SOLANA_ADDRESS: {
    MIN_LENGTH: 32,
    MAX_LENGTH: 44,
    BASE58_REGEX: /^[1-9A-HJ-NP-Z]+$/,
  },
  AMOUNT: {
    MIN: 0.000001,
    MAX: NETWORK_FEES.MAX_AMOUNT,
  },
};

// Feature flags
export const FEATURE_FLAGS = {
  ENABLE_BIOMETRIC: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_TOKEN_METADATA: true,
  ENABLE_WALLET_GROUPS: true,
};

// Storage configuration
export const STORAGE_CONFIG = {
  KEYS: {
    WALLET_BASE: "wallet-base-storage",
    WALLET_BALANCE: "wallet-balance-storage",
    WALLET_ACTIVITY: "wallet-activity-storage",
    WALLET_HISTORICAL: "wallet-historical-storage",
    SOLANA_STORE: "solana-store",
  },
  MAX_ACTIVITY_RECORDS: 50, // Limit activity records to 50 per wallet
};

// API configuration
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds timeout for API requests
  RETRY_ATTEMPTS: 3, // Number of retry attempts for failed API requests
  CACHE_DURATION: {
    SOL_PRICE: 5 * 60 * 1000, // 5 minutes cache for SOL price
    TOKEN_METADATA: 10 * 60 * 1000, // 10 minutes cache for token metadata
  },
};
