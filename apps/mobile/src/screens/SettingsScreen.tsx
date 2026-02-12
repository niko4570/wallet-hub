import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Linking,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWalletStore } from "../store/walletStore";
import { useSolana } from "../hooks/useSolana";
import { LinkedWallet } from "../types/wallet";
import { WalletOption } from "../components/wallet/WalletOption";
import { cacheUtils } from "../utils/cache";

// Storage keys
const STORAGE_KEYS = {
  NOTIFICATIONS: "@WalletHub:notifications",
  BIOMETRICS: "@WalletHub:biometrics",
};

const SettingsScreen = () => {
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [cacheSize, setCacheSize] = useState("0 KB");

  // Wallet store and Solana context
  const { linkedWallets, activeWallet, removeWallet, setActiveWallet } = useWalletStore();
  const { disconnect } = useSolana();

  // Load settings from storage
  useEffect(() => {
    loadSettings();
    checkBiometricAvailability();
    calculateCacheSize();
  }, []);

  const loadSettings = async () => {
    try {
      const notificationsValue = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const biometricsValue = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRICS);
      
      if (notificationsValue !== null) {
        setNotifications(JSON.parse(notificationsValue));
      }
      if (biometricsValue !== null) {
        setBiometrics(JSON.parse(biometricsValue));
      }
    } catch (error) {
      console.warn("Error loading settings:", error);
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error saving ${key} setting:`, error);
    }
  };

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricAvailable(compatible && enrolled);
  };

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        if (key.startsWith("@WalletHub:")) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += value.length;
          }
        }
      }
      
      const sizeInKB = (totalSize / 1024).toFixed(2);
      setCacheSize(`${sizeInKB} KB`);
    } catch (error) {
      console.warn("Error calculating cache size:", error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotifications(value);
    await saveSetting(STORAGE_KEYS.NOTIFICATIONS, value);
    
    if (value) {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== "granted") {
        Alert.alert(
          "Notification Permission Required",
          "Please enable notifications in your device settings to receive alerts about your wallet activity.",
        );
        setNotifications(false);
        await saveSetting(STORAGE_KEYS.NOTIFICATIONS, false);
      }
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !isBiometricAvailable) {
      Alert.alert(
        "Biometric Not Available",
        "No biometric authentication methods are available on this device.",
      );
      return;
    }

    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to enable biometric access",
        cancelLabel: "Cancel",
        fallbackLabel: "Use Passcode",
      });

      if (!result.success) {
        return;
      }
    }

    setBiometrics(value);
    await saveSetting(STORAGE_KEYS.BIOMETRICS, value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      `Are you sure you want to clear the app cache (${cacheSize})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await cacheUtils.clearAllCache();
              await calculateCacheSize();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "Cache cleared successfully");
            } catch (error) {
              console.error("Error clearing cache:", error);
              Alert.alert("Error", "Failed to clear cache. Please try again.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout from all wallets?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnect();
              // Clear all wallet data
              linkedWallets.forEach((wallet) => removeWallet(wallet.address));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Success", "Logged out successfully");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleOpenWebsite = () => {
    Linking.openURL("https://wallethub.app").catch((err) =>
      console.warn("Failed to open website", err),
    );
  };

  const handleOpenPrivacyPolicy = () => {
    Linking.openURL("https://wallethub.app/privacy").catch((err) =>
      console.warn("Failed to open privacy policy", err),
    );
  };

  const handleOpenTermsOfService = () => {
    Linking.openURL("https://wallethub.app/terms").catch((err) =>
      console.warn("Failed to open terms of service", err),
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.settingCard}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Profile</Text>
              <Text style={styles.settingDescription}>
                Manage your profile information
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Connected Wallets</Text>
              <Text style={styles.settingDescription}>
                {linkedWallets.length} wallet
                {linkedWallets.length !== 1 ? "s" : ""} connected
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          {linkedWallets.length > 0 && (
            <View style={styles.walletList}>
              {linkedWallets.map((wallet) => (
                <WalletOption
                  key={wallet.address}
                  wallet={wallet}
                  isActive={wallet.address === activeWallet?.address}
                  onSelect={() => setActiveWallet(wallet)}
                  onRemove={() => {
                    Alert.alert(
                      "Remove Wallet",
                      "Are you sure you want to remove this wallet?",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () => {
                            removeWallet(wallet.address);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          },
                        },
                      ],
                      { cancelable: true },
                    );
                  }}
                />
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Security</Text>
              <Text style={styles.settingDescription}>
                Manage security settings
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.settingCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive app notifications
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={handleNotificationToggle}
              trackColor={{
                false: "rgba(255, 255, 255, 0.2)",
                true: "rgba(127, 86, 217, 0.6)",
              }}
              thumbColor={notifications ? "#7F56D9" : "rgba(255, 255, 255, 0.4)"}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>
                Use fingerprint or face ID
              </Text>
            </View>
            <Switch
              value={biometrics}
              onValueChange={handleBiometricToggle}
              trackColor={{
                false: "rgba(255, 255, 255, 0.2)",
                true: "rgba(127, 86, 217, 0.6)",
              }}
              thumbColor={biometrics ? "#7F56D9" : "rgba(255, 255, 255, 0.4)"}
              disabled={!isBiometricAvailable}
            />
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Text style={styles.settingDescription}>Use dark theme</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{
                false: "rgba(255, 255, 255, 0.2)",
                true: "rgba(127, 86, 217, 0.6)",
              }}
              thumbColor={darkMode ? "#7F56D9" : "rgba(255, 255, 255, 0.4)"}
            />
          </View>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleClearCache}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Clear Cache</Text>
              <Text style={styles.settingDescription}>
                Clear app cache data ({cacheSize})
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingCard}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleOpenWebsite}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Website</Text>
              <Text style={styles.settingDescription}>Visit our website</Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleOpenPrivacyPolicy}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.settingDescription}>
                Read our privacy policy
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleOpenTermsOfService}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Terms of Service</Text>
              <Text style={styles.settingDescription}>
                Read our terms of service
              </Text>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Version</Text>
              <Text style={styles.settingDescription}>1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {/* Footer */}
      <Text style={styles.footerText}>WalletHub © 2026</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1221",
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  settingCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 4,
  },
  settingDescription: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  settingArrow: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 20,
  },
  logoutButton: {
    backgroundColor: "rgba(255, 77, 77, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 77, 0.4)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 32,
  },
  logoutButtonText: {
    color: "#FF4D4D",
    fontWeight: "700",
    fontSize: 16,
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    textAlign: "center",
  },
  walletList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

export default SettingsScreen;