import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { API_URL } from "../../config/env";
import { handleApiError } from "../../utils";

const MAX_TRACKED_ADDRESSES = 32;

// UUID validation regex
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const normalizeAddress = (address?: string | null) => {
  if (!address || typeof address !== "string") {
    return null;
  }
  const trimmed = address.trim();
  return trimmed.length > 0 ? trimmed : null;
};

let cachedPushToken: string | null = null;
let lastRegistrationKey: string | null = null;

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  // Request permissions for notifications
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return false;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      return true;
    } catch (error) {
      handleApiError(error, "Error requesting notification permissions");
      return false;
    }
  },

  // Schedule a local notification
  async scheduleNotification({
    title,
    body,
    data,
  }: {
    title: string;
    body: string;
    data?: any;
  }): Promise<string> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: null, // Immediate notification
      });

      // Trigger haptics for notification
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      return id;
    } catch (error) {
      handleApiError(error, "Error scheduling notification");
      throw error;
    }
  },

  async getPushToken(): Promise<string | null> {
    try {
      if (cachedPushToken) {
        return cachedPushToken;
      }

      // Check if projectId is a valid UUID format
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId || !isValidUUID(projectId)) {
        console.log(
          "Skipping push token retrieval: invalid or missing project ID. This is expected in development.",
        );
        return null;
      }

      // Try to get push token with valid project ID
      try {
        const response = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        cachedPushToken = response.data;
        return cachedPushToken;
      } catch (firebaseError) {
        // Handle Firebase initialization error gracefully
        console.warn(
          "Firebase initialization error (expected in development):",
          firebaseError,
        );

        return null;
      }
    } catch (error) {
      handleApiError(error, "Error fetching Expo push token");
      return null;
    }
  },

  async registerDeviceSubscriptions(addresses: string[]): Promise<void> {
    try {
      const granted = await this.requestPermissions();
      if (!granted) {
        return;
      }

      const token = await this.getPushToken();
      if (!token) {
        return;
      }

      const normalizedAddresses = Array.from(
        new Set(
          (addresses ?? [])
            .map((addr) => normalizeAddress(addr))
            .filter((addr): addr is string => Boolean(addr)),
        ),
      ).slice(0, MAX_TRACKED_ADDRESSES);

      const registrationSignature = `${token}:${normalizedAddresses.join(",")}`;
      if (registrationSignature === lastRegistrationKey) {
        return;
      }

      const payload: {
        token: string;
        addresses?: string[];
      } = { token };

      if (normalizedAddresses.length > 0) {
        payload.addresses = normalizedAddresses;
      }

      const response = await fetch(`${API_URL}/notifications/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Notification register failed (${response.status}): ${errorText}`,
        );
      }

      lastRegistrationKey = registrationSignature;
      console.log(
        `Registered push token for ${normalizedAddresses.length} address(es)`,
      );
    } catch (error) {
      handleApiError(error, "Failed to register notification subscriptions");
    }
  },

  // Schedule a notification with a delay
  async scheduleDelayedNotification({
    title,
    body,
    seconds,
    data,
  }: {
    title: string;
    body: string;
    seconds: number;
    data?: any;
  }): Promise<string> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: {
          seconds,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });

      return id;
    } catch (error) {
      handleApiError(error, "Error scheduling delayed notification");
      throw error;
    }
  },

  // Cancel a scheduled notification
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      handleApiError(error, "Error canceling notification");
    }
  },

  // Cancel all scheduled notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      handleApiError(error, "Error canceling all notifications");
    }
  },

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<
    Notifications.NotificationRequest[]
  > {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      handleApiError(error, "Error getting scheduled notifications");
      return [];
    }
  },

  // Handle wallet activity notifications
  async notifyWalletActivity(activity: {
    type: string;
    amount: number;
    symbol: string;
    address: string;
  }): Promise<void> {
    try {
      const { type, amount, symbol, address } = activity;

      const title = type === "receive" ? "Received Funds" : "Sent Funds";
      const body =
        type === "receive"
          ? `You received ${amount} ${symbol} to ${address.substring(0, 6)}...`
          : `You sent ${amount} ${symbol} from ${address.substring(0, 6)}...`;

      await this.scheduleNotification({ title, body, data: activity });
    } catch (error) {
      handleApiError(error, "Error notifying wallet activity");
    }
  },

  // Handle token price change notifications
  async notifyPriceChange({
    symbol,
    oldPrice,
    newPrice,
  }: {
    symbol: string;
    oldPrice: number;
    newPrice: number;
  }): Promise<void> {
    try {
      const change = ((newPrice - oldPrice) / oldPrice) * 100;
      const changeText =
        change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
      const title = `Price Change: ${symbol}`;
      const body = `Price changed from $${oldPrice.toFixed(2)} to $${newPrice.toFixed(2)} (${changeText})`;

      await this.scheduleNotification({
        title,
        body,
        data: { symbol, oldPrice, newPrice, change },
      });
    } catch (error) {
      handleApiError(error, "Error notifying price change");
    }
  },

  // Handle balance update notifications
  async notifyBalanceUpdate({
    address,
    oldBalance,
    newBalance,
    symbol,
  }: {
    address: string;
    oldBalance: number;
    newBalance: number;
    symbol: string;
  }): Promise<void> {
    try {
      const change = newBalance - oldBalance;
      const changeText =
        change >= 0 ? `+${change.toFixed(4)}` : `${change.toFixed(4)}`;
      const title = `Balance Updated: ${symbol}`;
      const body = `Your balance changed to ${newBalance.toFixed(4)} ${symbol} (${changeText})`;

      await this.scheduleNotification({
        title,
        body,
        data: { address, oldBalance, newBalance, symbol, change },
      });
    } catch (error) {
      handleApiError(error, "Error notifying balance update");
    }
  },
};

export default notificationService;
