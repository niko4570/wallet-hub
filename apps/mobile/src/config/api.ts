export const API_CONFIG = {
  // Wallet directory APIs
  WALLET_DIRECTORY: {
    SOLANA_WALLET_ADAPTER: 'https://raw.githubusercontent.com/solana-mobile/mobile-wallet-adapter/main/packages/mobile-wallet-adapter-protocol/spec/wallet-registry.json',
    WALLET_CONNECT: 'https://registry.walletconnect.org/v3/wallets',
  },
  
  // Icon CDN endpoints
  ICON_CDN: {
    SOLANA_WALLETS: 'https://cdn.jsdelivr.net/gh/solana-labs/wallet-adapter@main/packages/wallets/icons',
    WALLET_CONNECT_ICONS: 'https://registry.walletconnect.org/v3/icons',
  },
  
  // Price APIs
  PRICE_API: {
    COINGECKO: 'https://api.coingecko.com/api/v3',
  },
  
  // Timeouts
  TIMEOUTS: {
    WALLET_DETECTION: 5000,
    ICON_LOADING: 3000,
    PRICE_FETCH: 2000,
  },
  
  // Cache settings
  CACHE: {
    ICON_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
    PRICE_TTL: 5 * 60 * 1000, // 5 minutes
    WALLET_REGISTRY_TTL: 24 * 60 * 60 * 1000, // 24 hours
  },
};

export const getWalletIconUrl = (walletId: string): string => {
  // Default icon URL pattern
  return `${API_CONFIG.ICON_CDN.SOLANA_WALLETS}/${walletId}.svg`;
};

export const getFallbackIcon = (walletId: string): string => {
  // Mapping of wallet IDs to fallback emojis
  const iconMap: Record<string, string> = {
    phantom: '🟣',
    solflare: '🟠',
    backpack: '🧳',
    glow: '✨',
    tiplink: '🔗',
    safepal: '🔐',
    trust: '🛡️',
    sollet: '💼',
  };
  
  return iconMap[walletId] || '💳';
};
