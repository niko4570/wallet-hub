import * as Crypto from "expo-crypto";

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface EncryptedData {
  iv: string;
  salt: string;
  data: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: string | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  async initialize(password?: string): Promise<void> {
    if (this.masterKey) {
      return;
    }

    if (password) {
      this.masterKey = await this.deriveKeyFromPassword(password);
    } else {
      this.masterKey = await this.generateKey();
    }
  }

  private async generateKey(): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(KEY_LENGTH);
    return this.arrayBufferToBase64(randomBytes);
  }

  private async deriveKeyFromPassword(
    password: string,
    salt?: Uint8Array,
  ): Promise<string> {
    const saltBytes = salt || (await Crypto.getRandomBytesAsync(SALT_LENGTH));
    const passwordBytes = new TextEncoder().encode(password);

    const combined = new Uint8Array(saltBytes.length + passwordBytes.length);
    combined.set(saltBytes, 0);
    combined.set(passwordBytes, saltBytes.length);

    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.arrayBufferToBase64(combined),
    );

    return hash.substring(0, KEY_LENGTH);
  }

  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error("EncryptionService not initialized");
    }

    const iv = await Crypto.getRandomBytesAsync(IV_LENGTH);
    const salt = await Crypto.getRandomBytesAsync(SALT_LENGTH);
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const keyBytes = new TextEncoder().encode(this.masterKey);

    const combined = new Uint8Array(salt.length + keyBytes.length);
    combined.set(salt, 0);
    combined.set(keyBytes, salt.length);

    const derivedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.arrayBufferToBase64(combined),
    );

    const derivedKeyBytes = new TextEncoder().encode(
      derivedKey.substring(0, 32),
    );

    const encrypted = await this.xorEncrypt(
      plaintextBytes,
      derivedKeyBytes,
      iv,
    );

    return {
      iv: this.arrayBufferToBase64(iv),
      salt: this.arrayBufferToBase64(salt),
      data: this.arrayBufferToBase64(encrypted),
    };
  }

  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.masterKey) {
      throw new Error("EncryptionService not initialized");
    }

    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    const salt = this.base64ToArrayBuffer(encryptedData.salt);
    const data = this.base64ToArrayBuffer(encryptedData.data);

    const keyBytes = new TextEncoder().encode(this.masterKey);

    const combined = new Uint8Array(salt.length + keyBytes.length);
    combined.set(salt, 0);
    combined.set(keyBytes, salt.length);

    const derivedKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      this.arrayBufferToBase64(combined),
    );

    const derivedKeyBytes = new TextEncoder().encode(
      derivedKey.substring(0, 32),
    );

    const decrypted = await this.xorDecrypt(data, derivedKeyBytes, iv);

    return new TextDecoder().decode(decrypted);
  }

  async encryptObject<T>(obj: T): Promise<EncryptedData> {
    const jsonString = JSON.stringify(obj);
    return await this.encrypt(jsonString);
  }

  async decryptObject<T>(encryptedData: EncryptedData): Promise<T> {
    const jsonString = await this.decrypt(encryptedData);
    return JSON.parse(jsonString) as T;
  }

  async hash(data: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data,
    );
    return hash;
  }

  async generateSecureRandom(length: number): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    return this.arrayBufferToBase64(randomBytes);
  }

  private async xorEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
  ): Promise<Uint8Array> {
    const encrypted = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) {
      encrypted[i] = plaintext[i] ^ key[i % key.length] ^ iv[i % iv.length];
    }
    return encrypted;
  }

  private async xorDecrypt(
    ciphertext: Uint8Array,
    key: Uint8Array,
    iv: Uint8Array,
  ): Promise<Uint8Array> {
    const decrypted = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      decrypted[i] = ciphertext[i] ^ iv[i % iv.length] ^ key[i % key.length];
    }
    return decrypted;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  isInitialized(): boolean {
    return this.masterKey !== null;
  }

  async clear(): Promise<void> {
    this.masterKey = null;
  }
}

export const encryptionService = EncryptionService.getInstance();
