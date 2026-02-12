import React, { useEffect, useState, memo } from "react";
import { View, Image, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SvgXml, SvgUri } from "react-native-svg";
import { iconService } from "../../services/iconService";

// SVG content for local wallet icons (required for React Native SVG rendering)
const walletIconSvgs = {
  phantom: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#59269E"/>
    <path d="M20 10C14.48 10 10 14.48 10 20C10 25.52 14.48 30 20 30C25.52 30 30 25.52 30 20C30 14.48 25.52 10 20 10ZM20 27C16.14 27 13 23.86 13 20C13 16.14 16.14 13 20 13C23.86 13 27 16.14 27 20C27 23.86 23.86 27 20 27Z" fill="white"/>
    <path d="M17 17L23 23M23 17L17 23" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  solflare: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#FF6B35"/>
    <path d="M15 20H25M25 20L20 15M25 20L20 25" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  backpack: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#3A86FF"/>
    <path d="M15 18V22M25 18V22M17 18C17 16.8954 17.8954 16 19 16H21C22.1046 16 23 16.8954 23 18M17 22C17 23.1046 17.8954 24 19 24H21C22.1046 24 23 23.1046 23 22M15 18L17 18M23 18L25 18M15 22L17 22M23 22L25 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  glow: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#8A2BE2"/>
    <path d="M20 15C22.7614 15 25 17.2386 25 20C25 22.7614 22.7614 25 20 25C17.2386 25 15 22.7614 15 20C15 17.2386 17.2386 15 20 15Z" fill="white" fill-opacity="0.8"/>
    <path d="M20 17C21.6569 17 23 18.3431 23 20C23 21.6569 21.6569 23 20 23C18.3431 23 17 21.6569 17 20C17 18.3431 18.3431 17 20 17Z" fill="white"/>
  </svg>`,
  tiplink: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#4CAF50"/>
    <path d="M15 20H25M25 20L20 15M25 20L20 25" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 20L17 22M15 20L17 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  safepal: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#4B0082"/>
    <path d="M17 20H23M23 20L20 17M23 20L20 23" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17 17L19 19M17 23L19 21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  trust: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="20" fill="#0052D9"/>
    <path d="M17 15L20 12L23 15V25L20 28L17 25V15Z" fill="white"/>
    <path d="M19 18V22" stroke="#0052D9" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
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
        if (walletIcon) {
          setIconUrl(walletIcon);
        } else {
          // Fall back to icon service
          const icon = await iconService.getWalletIcon(walletId);
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
        // Use static SVG content for local wallet icons
        const svgContent =
          walletIconSvgs[localWalletId as keyof typeof walletIconSvgs];
        if (svgContent) {
          return (
            <View
              style={[styles.container, { width: size, height: size }, style]}
            >
              <SvgXml
                xml={svgContent}
                width={size}
                height={size}
                onError={() => {
                  setError(new Error("Failed to load local SVG icon"));
                  setIconUrl(null);
                }}
              />
            </View>
          );
        } else {
          throw new Error(`No local SVG icon found for ${localWalletId}`);
        }
      } catch (error) {
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
