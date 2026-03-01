import { LinkedWallet } from "./wallet";

/**
 * Enhanced wallet session type for multi-wallet support.
 * Each session is independent and maintains its own authorization state.
 */
export interface WalletSession extends LinkedWallet {
  /** Unique session identifier */
  sessionId: string;
  /** Wallet label (user-customizable, e.g., "Phantom 1") */
  label: string;
  /** Whether this session is currently active */
  isActive: boolean;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Connection status */
  status: "connected" | "disconnected" | "error";
  /** Error message if status is "error" */
  errorMessage?: string;
}

/**
 * Multi-wallet manager state.
 */
export interface MultiWalletState {
  /** All connected wallet sessions */
  sessions: Record<string, WalletSession>;
  /** Order of wallet sessions (for UI display) */
  sessionOrder: string[];
  /** Currently active wallet session ID */
  activeSessionId: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Multi-wallet manager actions.
 */
export interface MultiWalletActions {
  /** Add a new wallet session */
  addSession: (session: WalletSession) => void;
  /** Remove a wallet session by session ID */
  removeSession: (sessionId: string) => void;
  /** Update a wallet session */
  updateSession: (sessionId: string, updates: Partial<WalletSession>) => void;
  /** Set active wallet session */
  setActiveSession: (sessionId: string | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all sessions */
  clearAllSessions: () => void;
  /** Get session by wallet address */
  getSessionByAddress: (address: string) => WalletSession | undefined;
  /** Get all sessions as array */
  getAllSessions: () => WalletSession[];
}

/**
 * Result of adding a wallet.
 */
export interface AddWalletResult {
  /** Session ID of the newly added wallet */
  sessionId: string;
  /** Wallet session object */
  session: WalletSession;
}

/**
 * Configuration for wallet association.
 */
export interface WalletAssociationConfig {
  /** Custom base URI for wallet association */
  baseUri?: string;
  /** Wallet label (e.g., "Phantom 1", "Solflare 2") */
  label?: string;
}

/**
 * Sign transaction options.
 */
export interface SignTransactionOptions {
  /** Session ID to use (defaults to active session) */
  sessionId?: string;
  /** Wallet address to use (defaults to active wallet) */
  walletAddress?: string;
}

/**
 * Multi-wallet manager public API.
 */
export interface UseMultiWalletManagerReturn {
  /** All connected wallet sessions */
  sessions: WalletSession[];
  /** Currently active wallet session */
  activeSession: WalletSession | null;
  /** Active wallet address */
  activeWalletAddress: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Add a new wallet session */
  addWallet: (config?: WalletAssociationConfig) => Promise<AddWalletResult>;
  /** Remove a wallet session */
  removeWallet: (sessionIdOrAddress: string) => Promise<void>;
  /** Set active wallet session */
  setActiveWallet: (sessionIdOrAddress: string) => void;
  /** Sign a transaction with specified wallet */
  signTransaction: (
    transaction: import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction,
    options?: SignTransactionOptions
  ) => Promise<Uint8Array>;
  /** Sign multiple transactions */
  signAllTransactions: (
    transactions: Array<import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>,
    options?: SignTransactionOptions
  ) => Promise<Uint8Array[]>;
  /** Sign a message */
  signMessage: (
    message: Uint8Array,
    options?: SignTransactionOptions
  ) => Promise<Uint8Array>;
  /** Disconnect all wallets */
  disconnectAll: () => Promise<void>;
  /** Refresh authorization for a session */
  refreshSession: (sessionId: string) => Promise<WalletSession | null>;
  /** Update wallet label */
  updateWalletLabel: (sessionIdOrAddress: string, label: string) => void;
  /** Check if any wallet is connected */
  hasWallets: boolean;
  /** Number of connected wallets */
  walletCount: number;
}
