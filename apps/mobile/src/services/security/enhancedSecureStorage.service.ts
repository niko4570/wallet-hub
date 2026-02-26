import * as SecureStore from 'expo-secure-store';
import { encryptionService, EncryptedData } from './encryption.service';

export interface SecureStorageOptions {
  requireAuth?: boolean;
  encrypt?: boolean;
}

export class EnhancedSecureStorageService {
  private static instance: EnhancedSecureStorageService;

  private constructor() {}

  static getInstance(): EnhancedSecureStorageService {
    if (!EnhancedSecureStorageService.instance) {
      EnhancedSecureStorageService.instance = new EnhancedSecureStorageService();
    }
    return EnhancedSecureStorageService.instance;
  }

  async initialize(password?: string): Promise<void> {
    await encryptionService.initialize(password);
  }

  async setItem(
    key: string,
    value: string,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    const { requireAuth = false, encrypt = false } = options;

    try {
      let valueToStore = value;

      if (encrypt) {
        if (!encryptionService.isInitialized()) {
          throw new Error('Encryption service not initialized');
        }
        const encrypted = await encryptionService.encrypt(value);
        valueToStore = JSON.stringify(encrypted);
      }

      const secureStoreOptions = requireAuth
        ? {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to secure your data',
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          }
        : {
            keychainAccessible: SecureStore.WHEN_UNLOCKED,
          };

      await SecureStore.setItemAsync(key, valueToStore, secureStoreOptions);
    } catch (error) {
      console.error('Error storing secure item:', error);
      throw new Error('Failed to store secure item');
    }
  }

  async getItem(
    key: string,
    options: SecureStorageOptions = {},
  ): Promise<string | null> {
    const { requireAuth = false, encrypt = false } = options;

    try {
      const secureStoreOptions = requireAuth
        ? {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to access your secure data',
          }
        : {};

      const storedValue = await SecureStore.getItemAsync(key, secureStoreOptions);
      if (!storedValue) {
        return null;
      }

      if (encrypt) {
        if (!encryptionService.isInitialized()) {
          throw new Error('Encryption service not initialized');
        }
        try {
          const encryptedData = JSON.parse(storedValue) as EncryptedData;
          return await encryptionService.decrypt(encryptedData);
        } catch (parseError) {
          console.warn('Failed to decrypt stored value, returning as-is');
          return storedValue;
        }
      }

      return storedValue;
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      throw new Error('Failed to retrieve secure item');
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error deleting secure item:', error);
      throw new Error('Failed to delete secure item');
    }
  }

  async setComplexItem<T>(
    key: string,
    data: T,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    try {
      const serializedData = JSON.stringify(data);
      await this.setItem(key, serializedData, options);
    } catch (error) {
      console.error('Error storing complex secure item:', error);
      throw new Error('Failed to store complex secure item');
    }
  }

  async getComplexItem<T>(
    key: string,
    options: SecureStorageOptions = {},
  ): Promise<T | null> {
    try {
      const serializedData = await this.getItem(key, options);
      if (!serializedData) return null;
      return JSON.parse(serializedData) as T;
    } catch (error) {
      console.error('Error retrieving complex secure item:', error);
      throw new Error('Failed to retrieve complex secure item');
    }
  }

  async hasKey(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null;
    } catch {
      return false;
    }
  }

  async storeWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session',
    value: string,
  ): Promise<void> {
    const key = `wallet_${walletAddress}_${dataType}`;
    const isSensitive = dataType === 'privateKey' || dataType === 'authToken';
    await this.setItem(key, value, { encrypt: isSensitive });
  }

  async getWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session',
  ): Promise<string | null> {
    const key = `wallet_${walletAddress}_${dataType}`;
    const isSensitive = dataType === 'privateKey' || dataType === 'authToken';
    return await this.getItem(key, { encrypt: isSensitive });
  }

  async removeWalletData(
    walletAddress: string,
    dataType: 'authToken' | 'privateKey' | 'session',
  ): Promise<void> {
    const key = `wallet_${walletAddress}_${dataType}`;
    await this.removeItem(key);
  }

  async storeUserPreference(key: string, value: string): Promise<void> {
    const storageKey = `user_preference_${key}`;
    await this.setItem(storageKey, value);
  }

  async getUserPreference(key: string): Promise<string | null> {
    const storageKey = `user_preference_${key}`;
    return await this.getItem(storageKey);
  }

  async clearAllWalletData(walletAddress: string): Promise<void> {
    await Promise.all([
      this.removeWalletData(walletAddress, 'authToken'),
      this.removeWalletData(walletAddress, 'privateKey'),
      this.removeWalletData(walletAddress, 'session'),
    ]);
  }

  async migrateFromOldStorage(
    oldKey: string,
    newKey: string,
    options: SecureStorageOptions = {},
  ): Promise<void> {
    try {
      const value = await SecureStore.getItemAsync(oldKey);
      if (value) {
        await this.setItem(newKey, value, options);
        await SecureStore.deleteItemAsync(oldKey);
      }
    } catch (error) {
      console.error('Error migrating storage:', error);
      throw new Error('Failed to migrate storage');
    }
  }
}

export const enhancedSecureStorage = EnhancedSecureStorageService.getInstance();

export const SECURE_STORAGE_KEYS = {
  PRIVATE_KEY: 'wallet_private_key',
  SESSION_TOKEN: 'wallet_session_token',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  ENCRYPTED_SEED: 'encrypted_seed',
  WALLET_CONNECT_SESSION: 'wallet_connect_session',
  ENCRYPTION_KEY: 'master_encryption_key',
};