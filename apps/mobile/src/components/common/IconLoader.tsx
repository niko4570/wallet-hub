import React, { useEffect, useState, memo } from "react";
import { View, Image, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SvgUri } from "react-native-svg";
import { iconService } from "../../services/iconService";

// Static mapping for local wallet icons (required for React Native bundling)
const localWalletIcons = {
  phantom: require("../../assets/icons/wallets/phantom.svg"),
  solflare: require("../../assets/icons/wallets/solflare.svg"),
  backpack: require("../../assets/icons/wallets/backpack.svg"),
  glow: require("../../assets/icons/wallets/glow.svg"),
  tiplink: require("../../assets/icons/wallets/tiplink.svg"),
  safepal: require("../../assets/icons/wallets/safepal.svg"),
  trust: require("../../assets/icons/wallets/trust.svg"),
};

interface IconLoaderProps {
  walletId: string;
  walletIcon?: string; // Wallet's own icon (from authorization result)
  size?: number;
  style?: object;
}

export const IconLoader: React.FC<IconLoaderProps> = memo(
  ({ walletId, walletIcon, size = 40, style }) => {
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      loadIcon();
    }, [walletId, walletIcon]);

    const loadIcon = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Log icon loading process
        console.log("IconLoader loading for walletId:", walletId);
        console.log("Wallet icon provided:", !!walletIcon);
        if (walletIcon) {
          console.log("Wallet icon type:", typeof walletIcon);
          console.log(
            "Wallet icon starts with data:",
            walletIcon.startsWith("data:"),
          );
          console.log("Wallet icon length:", walletIcon.length);
          setIconUrl(walletIcon);
        } else {
          console.log("Falling back to icon service for:", walletId);
          // Fall back to icon service
          const icon = await iconService.getWalletIcon(walletId);
          console.log("Icon service returned:", icon);
          setIconUrl(icon);
        }
      } catch (err) {
        console.warn(`Error loading icon for ${walletId}:`, err);
        setError(err as Error);
        // Icon service will return fallback, so we don't need to handle this
      } finally {
        setIsLoading(false);
      }
    };

    const getFallbackIcon = () => {
      try {
        return iconService.getIconSource(walletId).url;
      } catch {
        return "💳";
      }
    };

    if (isLoading) {
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <ActivityIndicator size="small" color="#8EA4FF" />
        </View>
      );
    }

    if (error || !iconUrl) {
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <Text style={{ fontSize: size * 0.6 }}>{getFallbackIcon()}</Text>
        </View>
      );
    }

    // Check if it's an emoji (fallback)
    if (
      iconUrl.length < 10 &&
      !iconUrl.startsWith("http") &&
      !iconUrl.startsWith("data:") &&
      !iconUrl.startsWith("local:")
    ) {
      // It's likely an emoji
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <Text style={{ fontSize: size * 0.6 }}>{iconUrl}</Text>
        </View>
      );
    }

    // Check if it's a local icon
    if (iconUrl.startsWith("local:")) {
      const localWalletId = iconUrl.replace("local:", "");
      try {
        // Use static mapping for local wallet icons (required for React Native bundling)
        const localIcon =
          localWalletIcons[localWalletId as keyof typeof localWalletIcons];
        if (localIcon) {
          return (
            <View
              style={[styles.container, { width: size, height: size }, style]}
            >
              <Image
                source={localIcon}
                style={{
                  width: "100%",
                  height: "100%",
                  resizeMode: "contain",
                }}
                onError={() => {
                  console.error("Failed to load local icon:", localWalletId);
                  setError(new Error("Failed to load local icon"));
                  setIconUrl(null);
                }}
              />
            </View>
          );
        } else {
          throw new Error(`No local icon found for ${localWalletId}`);
        }
      } catch (error) {
        console.error("Error loading local icon:", error);
        return (
          <View
            style={[styles.container, { width: size, height: size }, style]}
          >
            <Text style={{ fontSize: size * 0.6 }}>{getFallbackIcon()}</Text>
          </View>
        );
      }
    }

    // It's a URL or data URI; handle SVG separately since React Native Image can't render it
    const isSvg = iconUrl.toLowerCase().endsWith(".svg");

    if (isSvg) {
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <SvgUri
            uri={iconUrl}
            width={size}
            height={size}
            onError={() => {
              console.error("Failed to load SVG icon:", iconUrl);
              setError(new Error("Failed to load svg"));
              setIconUrl(null);
            }}
          />
        </View>
      );
    }

    // Render bitmap formats or data URIs
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={{ uri: iconUrl }}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "contain",
          }}
          onError={() => {
            console.error("Failed to load image icon:", iconUrl);
            setError(new Error("Failed to load image"));
            setIconUrl(null);
          }}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
  },
});
