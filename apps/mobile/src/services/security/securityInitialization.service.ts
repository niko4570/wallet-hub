import { enhancedSecureStorage } from './enhancedSecureStorage.service';
import { SECURE_STORAGE_KEYS } from './enhancedSecureStorage.service';

export class SecurityInitializationService {
  private static instance: SecurityInitializationService;
  private initialized = false;

  private constructor() {}

  static getInstance(): SecurityInitializationService {
    if (!SecurityInitializationService.instance) {
      SecurityInitializationService.instance = new SecurityInitializationService();
    }
    return SecurityInitializationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const hasEncryptionKey = await enhancedSecureStorage.hasKey(
        SECURE_STORAGE_KEYS.ENCRYPTION_KEY,
      );

      if (hasEncryptionKey) {
        const storedKey = await enhancedSecureStorage.getItem(
          SECURE_STORAGE_KEYS.ENCRYPTION_KEY,
        );
        if (storedKey) {
          await enhancedSecureStorage.initialize(storedKey);
        }
      } else {
        await enhancedSecureStorage.initialize();
        const newKey = await enhancedSecureStorage.getItem('temp_key');
        if (newKey) {
          await enhancedSecureStorage.setItem(
            SECURE_STORAGE_KEYS.ENCRYPTION_KEY,
            newKey,
            { encrypt: false },
          );
          await enhancedSecureStorage.removeItem('temp_key');
        }
      }

      this.initialized = true;
      console.log('Security initialization completed');
    } catch (error) {
      console.error('Security initialization failed:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      await enhancedSecureStorage.removeItem(SECURE_STORAGE_KEYS.ENCRYPTION_KEY);
      this.initialized = false;
      console.log('Security reset completed');
    } catch (error) {
      console.error('Security reset failed:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const securityInitializationService =
  SecurityInitializationService.getInstance();