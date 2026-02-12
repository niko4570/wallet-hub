import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage service for handling sensitive data encryption
 * Uses expo-secure-store to store data in an encrypted format
 */
export class SecureStorageService {
  /**
   * Stores a key-value pair in secure storage
   * @param key The key to store
   * @param value The value to store
   */
  static async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error storing data in secure storage:', error);
      throw new Error('Failed to store data securely');
    }
  }

  /**
   * Retrieves a value from secure storage
   * @param key The key to retrieve
   * @returns The stored value or null if not found
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error retrieving data from secure storage:', error);
      throw new Error('Failed to retrieve data securely');
    }
  }

  /**
   * Removes a value from secure storage
   * @param key The key to remove
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing data from secure storage:', error);
      throw new Error('Failed to remove data securely');
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
