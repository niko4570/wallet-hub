import { IconSource } from "../types/icon";

// Local wallet icons
const localWalletIcons: Record<string, any> = {
  phantom: require("../assets/icons/wallets/phantom.svg"),
  solflare: require("../assets/icons/wallets/solflare.svg"),
  backpack: require("../assets/icons/wallets/backpack.svg"),
  glow: require("../assets/icons/wallets/glow.svg"),
  tiplink: require("../assets/icons/wallets/tiplink.svg"),
  safepal: require("../assets/icons/wallets/safepal.svg"),
  trust: require("../assets/icons/wallets/trust.svg"),
};

class IconService {
  async fetchWalletIcon(walletId: string): Promise<string> {
    // Check if local icon exists (highest priority)
    if (localWalletIcons[walletId]) {
      // For React Native, require() returns a number (resource ID) for images
      // We'll store it as a string prefixed with 'local:' to identify it
      return `local:${walletId}`;
    }

    // Return fallback icon if no local icon available
    return this.getFallbackIcon(walletId);
  }

  async getWalletIcon(
    walletId: string,
    forceRefresh: boolean = false,
  ): Promise<string> {
    try {
      // Force refresh is not needed since we're using local icons
      return await this.fetchWalletIcon(walletId);
    } catch (error) {
      console.warn("Error getting wallet icon:", error);
      return this.getFallbackIcon(walletId);
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

  getFallbackIcon(walletId: string): string {
    // Mapping of wallet IDs to fallback emojis
    const iconMap: Record<string, string> = {
      phantom: "🟣",
      solflare: "🟠",
      backpack: "🧳",
      glow: "✨",
      tiplink: "🔗",
      safepal: "🔐",
      trust: "🛡️",
      sollet: "💼",
    };

    return iconMap[walletId] || "💳";
  }

  getIconSource(walletId: string): IconSource {
    // Check if local icon exists
    if (localWalletIcons[walletId]) {
      return {
        url: localWalletIcons[walletId],
        type: "svg", // All local icons are SVG
      };
    }

    // Fallback to emoji as text
    return {
      url: this.getFallbackIcon(walletId),
      type: "png", // Emoji treated as image
    };
  }
}

export const iconService = new IconService();
