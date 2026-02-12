import React, { memo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { IconLoader } from "../common/IconLoader";
import { DetectedWalletApp, LinkedWallet } from "../../types/wallet";

interface WalletOptionProps {
  wallet: DetectedWalletApp | LinkedWallet;
  disabled?: boolean;
  loading?: boolean;
  isActive?: boolean;
  onPress?: (wallet: DetectedWalletApp | LinkedWallet) => void;
  onSelect?: (wallet: LinkedWallet) => void;
  onRemove?: () => void;
}

export const WalletOption: React.FC<WalletOptionProps> = memo(
  ({
    wallet,
    disabled = false,
    loading = false,
    isActive = false,
    onPress,
    onSelect,
    onRemove,
  }) => {
    // Check if wallet is a DetectedWalletApp or LinkedWallet
    const isDetectedWallet = "installed" in wallet;
    const isLinkedWallet = "authToken" in wallet;

    const handlePress = () => {
      if (isLinkedWallet && onSelect && wallet) {
        onSelect(wallet);
      } else if (onPress && wallet) {
        onPress(wallet);
      }
    };

    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.walletInfo, disabled && styles.disabled]}
          disabled={disabled || loading}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <IconLoader
              walletId={
                isDetectedWallet ? wallet.id : wallet.walletAppId || "unknown"
              }
              walletIcon={isLinkedWallet ? wallet.icon : undefined}
              size={40}
            />
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.name}>
              {isDetectedWallet
                ? wallet.name
                : wallet.label || wallet.walletName || "Unknown Wallet"}
            </Text>
            {isDetectedWallet && wallet.subtitle && (
              <Text style={styles.subtitle}>{wallet.subtitle}</Text>
            )}
            {isLinkedWallet && (
              <Text style={styles.subtitle}>
                {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
              </Text>
            )}
          </View>

          <View style={styles.statusContainer}>
            {isActive && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
            {isDetectedWallet && (
              <Text
                style={[
                  styles.status,
                  wallet.installed ? styles.installed : styles.notInstalled,
                ]}
              >
                {wallet.installed ? "Installed" : "Not detected"}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {isLinkedWallet && onRemove && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={onRemove}
            activeOpacity={0.7}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  walletInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  iconContainer: {
    marginRight: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
  statusContainer: {
    marginLeft: 12,
  },
  status: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  installed: {
    color: "#8EA4FF",
  },
  notInstalled: {
    color: "rgba(255, 255, 255, 0.4)",
  },
  activeBadge: {
    backgroundColor: "rgba(127, 86, 217, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(127, 86, 217, 0.38)",
  },
  activeBadgeText: {
    color: "#7F56D9",
    fontSize: 11,
    fontWeight: "700",
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  removeButtonText: {
    color: "#C7B5FF",
    fontWeight: "600",
    fontSize: 14,
  },
});
