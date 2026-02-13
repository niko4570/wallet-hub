import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconCacheItem } from '../types/icon';

const CACHE_KEYS = {
  WALLET_ICONS: '@WalletHub:walletIcons',
  PRICE_CACHE: '@WalletHub:priceCache',
  WALLET_REGISTRY: '@WalletHub:walletRegistry',
  TOKEN_METADATA: '@WalletHub:tokenMetadata',
  WALLET_BALANCES: '@WalletHub:walletBalances',
};

export const cacheUtils = {
  // Icon caching
  async getCachedIcon(walletId: string): Promise<string | null> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.WALLET_ICONS);
      if (!cacheData) return null;
      
      const iconCache: Record<string, IconCacheItem> = JSON.parse(cacheData);
      const cachedItem = iconCache[walletId];
      
      if (!cachedItem) return null;
      
      // Check if cache is expired
      if (Date.now() > cachedItem.expiry) {
        await this.removeCachedIcon(walletId);
        return null;
      }
      
      return cachedItem.iconUrl;
    } catch (error) {
      console.warn('Error getting cached icon:', error);
      return null;
    }
  },
  
  async setCachedIcon(walletId: string, iconUrl: string, ttl: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.WALLET_ICONS);
      const iconCache: Record<string, IconCacheItem> = cacheData ? JSON.parse(cacheData) : {};
      
      iconCache[walletId] = {
        walletId,
        iconUrl,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      };
      
      await AsyncStorage.setItem(CACHE_KEYS.WALLET_ICONS, JSON.stringify(iconCache));
    } catch (error) {
      console.warn('Error setting cached icon:', error);
    }
  },
  
  async removeCachedIcon(walletId: string): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.WALLET_ICONS);
      if (!cacheData) return;
      
      const iconCache: Record<string, IconCacheItem> = JSON.parse(cacheData);
      delete iconCache[walletId];
      
      await AsyncStorage.setItem(CACHE_KEYS.WALLET_ICONS, JSON.stringify(iconCache));
    } catch (error) {
      console.warn('Error removing cached icon:', error);
    }
  },
  
  async clearIconCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.WALLET_ICONS);
    } catch (error) {
      console.warn('Error clearing icon cache:', error);
    }
  },
  
  // Price caching
  async getCachedPrice(symbol: string): Promise<number | null> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.PRICE_CACHE);
      if (!cacheData) return null;
      
      const priceCache: Record<string, { price: number; expiry: number }> = JSON.parse(cacheData);
      const cachedItem = priceCache[symbol];
      
      if (!cachedItem) return null;
      
      if (Date.now() > cachedItem.expiry) {
        await this.removeCachedPrice(symbol);
        return null;
      }
      
      return cachedItem.price;
    } catch (error) {
      console.warn('Error getting cached price:', error);
      return null;
    }
  },
  
  async setCachedPrice(symbol: string, price: number, ttl: number = 5 * 60 * 1000): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.PRICE_CACHE);
      const priceCache: Record<string, { price: number; expiry: number }> = cacheData ? JSON.parse(cacheData) : {};
      
      priceCache[symbol] = {
        price,
        expiry: Date.now() + ttl,
      };
      
      await AsyncStorage.setItem(CACHE_KEYS.PRICE_CACHE, JSON.stringify(priceCache));
    } catch (error) {
      console.warn('Error setting cached price:', error);
    }
  },
  
  async removeCachedPrice(symbol: string): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.PRICE_CACHE);
      if (!cacheData) return;
      
      const priceCache: Record<string, { price: number; expiry: number }> = JSON.parse(cacheData);
      delete priceCache[symbol];
      
      await AsyncStorage.setItem(CACHE_KEYS.PRICE_CACHE, JSON.stringify(priceCache));
    } catch (error) {
      console.warn('Error removing cached price:', error);
    }
  },
  
  // Wallet registry caching
  async getCachedWalletRegistry(): Promise<any | null> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.WALLET_REGISTRY);
      if (!cacheData) return null;
      
      const registryData = JSON.parse(cacheData);
      
      if (Date.now() > registryData.expiry) {
        await this.clearWalletRegistryCache();
        return null;
      }
      
      return registryData.data;
    } catch (error) {
      console.warn('Error getting cached wallet registry:', error);
      return null;
    }
  },
  
  async setCachedWalletRegistry(registryData: any, ttl: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cacheData = {
        data: registryData,
        expiry: Date.now() + ttl,
      };
      
      await AsyncStorage.setItem(CACHE_KEYS.WALLET_REGISTRY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Error setting cached wallet registry:', error);
    }
  },
  
  async clearWalletRegistryCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.WALLET_REGISTRY);
    } catch (error) {
      console.warn('Error clearing wallet registry cache:', error);
    }
  },

  // Token metadata caching
  async getCachedTokenMetadata(): Promise<any | null> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.TOKEN_METADATA);
      if (!cacheData) return null;

      const metadataCache = JSON.parse(cacheData);

      if (Date.now() > metadataCache.expiry) {
        await this.clearTokenMetadataCache();
        return null;
      }

      return metadataCache.data;
    } catch (error) {
      console.warn('Error getting cached token metadata:', error);
      return null;
    }
  },

  async setCachedTokenMetadata(
    metadata: any,
    ttl: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    try {
      const cacheData = {
        data: metadata,
        expiry: Date.now() + ttl,
      };

      await AsyncStorage.setItem(
        CACHE_KEYS.TOKEN_METADATA,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('Error setting cached token metadata:', error);
    }
  },

  async clearTokenMetadataCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.TOKEN_METADATA);
    } catch (error) {
      console.warn('Error clearing token metadata cache:', error);
    }
  },

  // Wallet balances caching
  async getCachedWalletBalances(): Promise<any | null> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_KEYS.WALLET_BALANCES);
      if (!cacheData) return null;

      const balancesCache = JSON.parse(cacheData);

      if (Date.now() > balancesCache.expiry) {
        await this.clearWalletBalancesCache();
        return null;
      }

      return balancesCache.data;
    } catch (error) {
      console.warn('Error getting cached wallet balances:', error);
      return null;
    }
  },

  async setCachedWalletBalances(
    balances: any,
    ttl: number = 30 * 1000
  ): Promise<void> {
    try {
      const cacheData = {
        data: balances,
        expiry: Date.now() + ttl,
      };

      await AsyncStorage.setItem(
        CACHE_KEYS.WALLET_BALANCES,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.warn('Error setting cached wallet balances:', error);
    }
  },

  async clearWalletBalancesCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEYS.WALLET_BALANCES);
    } catch (error) {
      console.warn('Error clearing wallet balances cache:', error);
    }
  },
  
  // Clear all cache
  async clearAllCache(): Promise<void> {
    try {
      await Promise.all([
        this.clearIconCache(),
        AsyncStorage.removeItem(CACHE_KEYS.PRICE_CACHE),
        this.clearWalletRegistryCache(),
        this.clearTokenMetadataCache(),
        this.clearWalletBalancesCache(),
      ]);
    } catch (error) {
      console.warn('Error clearing all cache:', error);
    }
  },
};
