export interface IconSource {
  url: string;
  type: 'svg' | 'png' | 'jpg' | 'webp';
  width?: number;
  height?: number;
}

export interface IconCacheItem {
  walletId: string;
  iconUrl: string;
  timestamp: number;
  expiry: number;
}

export interface IconLoadingState {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: number | null;
}

export interface WalletIconMap {
  [walletId: string]: IconSource;
}

export type IconFallback = string; // Emoji or default icon name
