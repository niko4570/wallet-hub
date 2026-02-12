import React, { useEffect, useState, memo } from "react";
import { View, Image, Text, ActivityIndicator, StyleSheet } from "react-native";
import { SvgUri } from "react-native-svg";
import { iconService } from "../../services/iconService";

interface IconLoaderProps {
  walletId: string;
  size?: number;
  style?: object;
}

export const IconLoader: React.FC<IconLoaderProps> = memo(
  ({ walletId, size = 40, style }) => {
    const [iconUrl, setIconUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      loadIcon();
    }, [walletId]);

    const loadIcon = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const icon = await iconService.getWalletIcon(walletId);
        setIconUrl(icon);
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

    // Check if it's an emoji (fallback) or a URL
    if (iconUrl.length < 10 || !iconUrl.startsWith("http")) {
      // It's likely an emoji
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <Text style={{ fontSize: size * 0.6 }}>{iconUrl}</Text>
        </View>
      );
    }

    // It's a URL; handle SVG separately since React Native Image can't render it
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

    // Render bitmap formats
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
