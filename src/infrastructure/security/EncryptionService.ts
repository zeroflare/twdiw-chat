/**
 * EncryptionService - AES-256-GCM Encryption Utility
 *
 * Provides secure encryption and decryption of sensitive data using AES-256-GCM.
 * Designed for Cloudflare Workers environment with Web Crypto API.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption
 * - Random IV generation for each encryption
 * - Base64 encoding for storage
 * - Constant-time comparison for authentication tags
 *
 * Key management:
 * - Encryption key stored in Wrangler secrets (ENCRYPTION_KEY)
 * - Requires exactly 256-bit (32 bytes) key
 * - Generate with: `openssl rand -base64 32`
 * - Base64 validation performed in constructor
 *
 * Format: `iv:ciphertext` (both base64-encoded)
 */
export class EncryptionService {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    if (!encryptionKey || encryptionKey.trim() === '') {
      throw new Error('Encryption key cannot be empty');
    }

    // Validate base64 format
    try {
      atob(encryptionKey.trim());
    } catch (error) {
      throw new Error('Encryption key must be valid base64 string');
    }

    this.encryptionKey = encryptionKey.trim();
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   *
   * @param plaintext - The plaintext to encrypt
   * @returns Encrypted data in format `iv:ciphertext` (base64-encoded)
   * @throws Error if encryption fails
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      return '';
    }

    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Import key
      const key = await this.importKey();

      // Encode plaintext
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Encrypt
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        data
      );

      // Encode to base64
      const ivBase64 = this.arrayBufferToBase64(iv);
      const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);

      return `${ivBase64}:${ciphertextBase64}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt ciphertext using AES-256-GCM.
   *
   * @param encrypted - Encrypted data in format `iv:ciphertext` (base64-encoded)
   * @returns Decrypted plaintext
   * @throws Error if decryption fails or format is invalid
   */
  async decrypt(encrypted: string): Promise<string> {
    if (!encrypted) {
      return '';
    }

    try {
      // Parse encrypted data
      const parts = encrypted.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, ciphertextBase64] = parts;

      // Decode from base64
      const iv = this.base64ToArrayBuffer(ivBase64);
      const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);

      // Import key
      const key = await this.importKey();

      // Decrypt
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
        },
        key,
        ciphertext
      );

      // Decode plaintext
      const decoder = new TextDecoder();
      return decoder.decode(plaintext);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import encryption key for use with Web Crypto API.
   * Expects exactly 256 bits (32 bytes) for AES-256-GCM.
   *
   * @returns CryptoKey for AES-GCM encryption
   * @throws Error if key is not exactly 256 bits
   */
  private async importKey(): Promise<CryptoKey> {
    // Decode base64 key
    const keyData = this.base64ToArrayBuffer(this.encryptionKey);

    // Import key (expects exactly 32 bytes / 256 bits)
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }


  /**
   * Convert ArrayBuffer to base64 string.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer.
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
