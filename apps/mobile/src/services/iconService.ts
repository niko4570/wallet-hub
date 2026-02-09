import { getWalletIconUrl, getFallbackIcon, API_CONFIG } from "../config/api";
import { cacheUtils } from "../utils/cache";
import { IconSource } from "../types/icon";

class IconService {
  private iconCache: Record<string, string> = {};
  private loadingPromises: Record<string, Promise<string>> = {};

  async fetchWalletIcon(walletId: string): Promise<string> {
    // Check memory cache first
    if (this.iconCache[walletId]) {
      return this.iconCache[walletId];
    }

    // Check disk cache
    const cachedIcon = await cacheUtils.getCachedIcon(walletId);
    if (cachedIcon) {
      this.iconCache[walletId] = cachedIcon;
      return cachedIcon;
    }

    // Check if already loading
    const existingPromise = this.loadingPromises[walletId];
    if (existingPromise) {
      return existingPromise;
    }

    // Create loading promise
    const loadingPromise = this.loadIconFromApi(walletId);
    this.loadingPromises[walletId] = loadingPromise;

    try {
      const iconUrl = await loadingPromise;
      this.iconCache[walletId] = iconUrl;
      return iconUrl;
    } catch (error) {
      console.warn(`Failed to load icon for ${walletId}:`, error);
      // Return fallback icon
      return getFallbackIcon(walletId);
    } finally {
      delete this.loadingPromises[walletId];
    }
  }

  private async loadIconFromApi(walletId: string): Promise<string> {
    try {
      // Try Solana Wallet Adapter icons
      const solanaIconUrl = getWalletIconUrl(walletId);

      // Skip validation in React Native to avoid network issues
      // Directly return the icon URL assuming it's valid
      await cacheUtils.setCachedIcon(walletId, solanaIconUrl);
      return solanaIconUrl;
    } catch (error) {
      console.warn("Error loading icon from API:", error);
      throw error;
    }
  }

  private async validateIconUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        API_CONFIG.TIMEOUTS.ICON_LOADING,
      );

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getWalletIcon(
    walletId: string,
    forceRefresh: boolean = false,
  ): Promise<string> {
    try {
      if (forceRefresh) {
        // Clear cache for this wallet
        delete this.iconCache[walletId];
        await cacheUtils.removeCachedIcon(walletId);
      }
      return await this.fetchWalletIcon(walletId);
    } catch (error) {
      console.warn("Error getting wallet icon:", error);
      return getFallbackIcon(walletId);
    }
  }

  async clearIconCache(): Promise<void> {
    try {
      await cacheUtils.clearIconCache();
      this.iconCache = {};
    } catch (error) {
      console.warn("Error clearing icon cache:", error);
    }
  }

  async prefetchWalletIcons(walletIds: string[]): Promise<void> {
    try {
      await Promise.all(
        walletIds.map((id) =>
          this.fetchWalletIcon(id).catch((err) => {
            console.warn(`Failed to prefetch icon for ${id}:`, err);
          }),
        ),
      );
    } catch (error) {
      console.warn("Error prefetching wallet icons:", error);
    }
  }

  getIconSource(walletId: string): IconSource {
    const iconUrl = this.iconCache[walletId];

    if (iconUrl) {
      return {
        url: iconUrl,
        type: this.getIconTypeFromUrl(iconUrl),
      };
    }

    // Fallback to emoji as text
    return {
      url: getFallbackIcon(walletId),
      type: "png", // Emoji treated as image
    };
  }

  private getIconTypeFromUrl(url: string): "svg" | "png" | "jpg" | "webp" {
    if (url.endsWith(".svg")) return "svg";
    if (url.endsWith(".png")) return "png";
    if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "jpg";
    if (url.endsWith(".webp")) return "webp";
    return "png"; // Default
  }
}

export const iconService = new IconService();
