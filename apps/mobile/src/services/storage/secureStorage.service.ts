import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage service for storing sensitive data using Expo Secure Store
 * This service provides a consistent interface for storing and retrieving sensitive data
 * like private keys, session tokens, and other confidential information
 */
export class SecureStorageService {
  /**
   * Store a value securely
   * @param key - The key to store the value under
   * @param value - The value to store
   * @param requireAuth - Whether to require biometric authentication for access
   */
  static async setItem(
    key: string,
    value: string,
    requireAuth: boolean = false
  ): Promise<void> {
    try {
      const options = requireAuth
        ? {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to secure your data',
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          }
        : {
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          };

      await SecureStore.setItemAsync(key, value, options);
    } catch (error) {
      console.error('Error storing secure item:', error);
      throw new Error('Failed to store secure item');
    }
  }

  /**
   * Retrieve a securely stored value
   * @param key - The key to retrieve the value for
   * @param requireAuth - Whether to require biometric authentication for access
   * @returns The stored value or null if not found
   */
  static async getItem(
    key: string,
    requireAuth: boolean = false
  ): Promise<string | null> {
    try {
      const options = requireAuth
        ? {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your secure data',
          }
        : {};

      return await SecureStore.getItemAsync(key, options);
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      throw new Error('Failed to retrieve secure item');
    }
  }

  /**
   * Delete a securely stored value
   * @param key - The key to delete
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error deleting secure item:', error);
      throw new Error('Failed to delete secure item');
    }
  }

  /**
   * Store complex data (objects/arrays) securely
   * @param key - The key to store the data under
   * @param data - The complex data to store
   * @param requireAuth - Whether to require biometric authentication for access
   */
  static async setComplexItem<T>(
    key: string,
    data: T,
    requireAuth: boolean = false
  ): Promise<void> {
    try {
      const serializedData = JSON.stringify(data);
      await this.setItem(key, serializedData, requireAuth);
    } catch (error) {
      console.error('Error storing complex secure item:', error);
      throw new Error('Failed to store complex secure item');
    }
  }

  /**
   * Retrieve complex data (objects/arrays) securely
   * @param key - The key to retrieve the data for
   * @param requireAuth - Whether to require biometric authentication for access
   * @returns The stored data or null if not found
   */
  static async getComplexItem<T>(
    key: string,
    requireAuth: boolean = false
  ): Promise<T | null> {
    try {
      const serializedData = await this.getItem(key, requireAuth);
      if (!serializedData) return null;
      return JSON.parse(serializedData) as T;
    } catch (error) {
      console.error('Error retrieving complex secure item:', error);
      throw new Error('Failed to retrieve complex secure item');
    }
  }

  /**
   * Check if a key exists in secure storage
   * @param key - The key to check
   * @returns Whether the key exists
   */
  static async hasKey(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all secure storage items (use with caution!)
   * Note: This will delete ALL secure storage items, not just those from this app
   */
  static async clear(): Promise<void> {
    try {
      // Expo Secure Store doesn't provide a clear() method
      // Individual items must be deleted by key
      // This method is kept for future compatibility
      console.warn('SecureStorageService.clear() is not implemented for Expo Secure Store');
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw new Error('Failed to clear secure storage');
    }
  }

  /**
   * Stores wallet-related sensitive data
   * @param walletAddress The wallet address
   * @param dataType The type of data to store
   * @param value The value to store
   */
  static async storeWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session',
    value: string
  ): Promise<void> {
    const key = `wallet_${walletAddress}_${dataType}`;
    await this.setItem(key, value);
  }

  /**
   * Retrieves wallet-related sensitive data
   * @param walletAddress The wallet address
   * @param dataType The type of data to retrieve
   * @returns The stored value or null if not found
   */
  static async getWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session'
  ): Promise<string | null> {
    const key = `wallet_${walletAddress}_${dataType}`;
    return await this.getItem(key);
  }

  /**
   * Removes wallet-related sensitive data
   * @param walletAddress The wallet address
   * @param dataType The type of data to remove
   */
  static async removeWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session'
  ): Promise<void> {
    const key = `wallet_${walletAddress}_${dataType}`;
    await this.removeItem(key);
  }

  /**
   * Stores user preferences securely
   * @param key The preference key
   * @param value The preference value
   */
  static async storeUserPreference(key: string, value: string): Promise<void> {
    const storageKey = `user_preference_${key}`;
    await this.setItem(storageKey, value);
  }

  /**
   * Retrieves user preferences securely
   * @param key The preference key
   * @returns The stored value or null if not found
   */
  static async getUserPreference(key: string): Promise<string | null> {
    const storageKey = `user_preference_${key}`;
    return await this.getItem(storageKey);
  }

  /**
   * Clears all secure storage data
   * This is a destructive operation and should be used with caution
   */
  static async clearAll(): Promise<void> {
    // Note: expo-secure-store doesn't provide a clearAll method
    // In a real app, you would need to track all keys and remove them individually
    console.warn('SecureStorageService.clearAll() called - this is a no-op in the current implementation');
  }
}

// Common keys for secure storage
export const SECURE_STORAGE_KEYS = {
  PRIVATE_KEY: 'wallet_private_key',
  SESSION_TOKEN: 'wallet_session_token',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  ENCRYPTED_SEED: 'encrypted_seed',
  WALLET_CONNECT_SESSION: 'wallet_connect_session',
};
